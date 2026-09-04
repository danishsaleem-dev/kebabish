"use server";

import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  addMedia,
  deleteMedia,
  getMedia,
  mediaUsage,
  updateMedia,
} from "@/lib/admin/store";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/**
 * Media uploads.
 *
 * ⚠️ Files are written to `public/uploads`, which works locally but NOT on
 * Vercel — its filesystem is read-only at runtime. This mirrors the interim
 * JSON store: when Supabase lands, `persistFile` becomes a Supabase Storage
 * upload and everything above it is unchanged.
 */

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads");
const PUBLIC_PREFIX = "/uploads";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 6 * 1024 * 1024;

function safeFilename(original: string): string {
  const ext = (original.match(/\.[a-zA-Z0-9]+$/)?.[0] ?? ".jpg").toLowerCase();
  const base = original
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  // Random suffix so re-uploading the same filename never overwrites.
  return `${base || "image"}-${randomBytes(4).toString("hex")}${ext}`;
}

export async function uploadMediaAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const files = formData.getAll("files").filter((f): f is File => f instanceof File);
  if (files.length === 0) return { ok: false, message: "Choose at least one image." };

  // Dimensions are measured in the browser before upload — reading them here
  // would mean pulling in an image-decoding dependency for no real gain.
  const widths = formData.getAll("widths").map((w) => Number(w) || 0);
  const heights = formData.getAll("heights").map((h) => Number(h) || 0);

  const uploaded: string[] = [];

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });

    for (const [index, file] of files.entries()) {
      if (file.size === 0) continue;
      if (!ALLOWED.has(file.type)) {
        return {
          ok: false,
          message: `${file.name}: only JPEG, PNG, WebP and AVIF are allowed.`,
        };
      }
      if (file.size > MAX_BYTES) {
        return {
          ok: false,
          message: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 6 MB.`,
        };
      }

      const filename = safeFilename(file.name);
      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(path.join(UPLOAD_DIR, filename), buffer);

      const record = await addMedia({
        url: `${PUBLIC_PREFIX}/${filename}`,
        filename: file.name,
        alt: "",
        mimeType: file.type,
        sizeBytes: file.size,
        width: widths[index] ?? 0,
        height: heights[index] ?? 0,
      });
      uploaded.push(record.id);
    }
  } catch (error) {
    return {
      ok: false,
      message:
        error instanceof Error
          ? `Upload failed: ${error.message}`
          : "Upload failed.",
    };
  }

  revalidateMedia();
  return {
    ok: true,
    message: `Uploaded ${uploaded.length} image${uploaded.length === 1 ? "" : "s"}.`,
  };
}

export async function updateMediaAltAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const alt = String(formData.get("alt") ?? "").trim();

  if (alt.length > 160) {
    return { ok: false, message: "Keep alt text under 160 characters." };
  }

  await updateMedia(id, alt);
  revalidateMedia();
  return { ok: true, message: "Saved." };
}

export async function deleteMediaAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const record = await getMedia(id);
  if (!record) return { ok: false, message: "Image not found." };

  const usage = await mediaUsage(id);
  const used = [...usage.items, ...usage.categories];
  const force = formData.get("force") === "true";

  if (used.length > 0 && !force) {
    return {
      ok: false,
      message: `Used by ${used.slice(0, 3).join(", ")}${used.length > 3 ? ` +${used.length - 3} more` : ""}. Delete anyway?`,
    };
  }

  await deleteMedia(id);

  // Remove the file too, but never fail the action over it — the record is
  // gone either way and an orphaned file is harmless.
  try {
    await unlink(path.join(process.cwd(), "public", record.url.replace(/^\//, "")));
  } catch {
    // already missing, or permissions — nothing to recover from here
  }

  revalidateMedia();
  return { ok: true, message: "Image deleted." };
}

function revalidateMedia() {
  revalidatePath("/admin/media");
  revalidatePath("/admin/menu");
  revalidatePath("/admin/menu/categories");
}
