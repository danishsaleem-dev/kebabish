"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import {
  addMedia,
  deleteMedia,
  getMedia,
  mediaUsage,
  updateMedia,
} from "@/lib/admin/store";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

/**
 * Media uploads, via Supabase Storage.
 *
 * Used to write to public/uploads, which worked locally but not on
 * Vercel — its filesystem is read-only at runtime, so every upload in
 * production failed with ENOENT. The bucket ("media", public, created
 * once via the Storage API) replaces that; everything above this file —
 * the store record, the picker, the gallery field — is unchanged, since
 * they only ever dealt with a URL string.
 */

const BUCKET = "media";

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

function publicUrl(path: string): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${BUCKET}/${path}`;
}

/** The storage object path from a public URL, for deletes. */
function pathFromUrl(url: string): string | null {
  const marker = `/storage/v1/object/public/${BUCKET}/`;
  const index = url.indexOf(marker);
  return index === -1 ? null : url.slice(index + marker.length);
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

  const storage = supabaseAdmin().storage.from(BUCKET);
  const uploaded: string[] = [];

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

    const { error } = await storage.upload(filename, buffer, {
      contentType: file.type,
      cacheControl: "31536000", // a year — the random suffix means the name never gets reused
    });

    if (error) {
      return { ok: false, message: `Upload failed: ${error.message}` };
    }

    const record = await addMedia({
      url: publicUrl(filename),
      filename: file.name,
      alt: "",
      mimeType: file.type,
      sizeBytes: file.size,
      width: widths[index] ?? 0,
      height: heights[index] ?? 0,
    });
    uploaded.push(record.id);
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

  // Remove the object too, but never fail the action over it — the record
  // is gone either way and an orphaned file is harmless.
  const objectPath = pathFromUrl(record.url);
  if (objectPath) {
    await supabaseAdmin().storage.from(BUCKET).remove([objectPath]);
  }

  revalidateMedia();
  return { ok: true, message: "Image deleted." };
}

function revalidateMedia() {
  revalidatePath("/admin/media");
  revalidatePath("/admin/menu");
  revalidatePath("/admin/menu/categories");
}
