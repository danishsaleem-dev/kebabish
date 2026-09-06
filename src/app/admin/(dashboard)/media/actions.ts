"use server";

import { randomBytes } from "node:crypto";
import sharp from "sharp";
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
 *
 * Every upload is re-encoded through sharp before it ever reaches
 * storage — a phone photo straight off a camera is routinely 3-5 MB at
 * 4000px+, and nothing on this site ever displays a dish photo wider than
 * ~1200px. Re-encoding to WebP and capping the longest side at
 * MAX_DIMENSION cuts that by 90%+ with no visible quality loss, and it's
 * done once here rather than repeatedly by Next's own image optimizer on
 * every request. Output is always WebP regardless of input format, so
 * there's one predictable format in the bucket rather than a mix.
 */

const BUCKET = "media";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 2400;
const WEBP_QUALITY = 82;

function safeFilename(original: string): string {
  const base = original
    .replace(/\.[^.]+$/, "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  // Random suffix so re-uploading the same filename never overwrites.
  // Always .webp — every upload is re-encoded to it, whatever it arrived as.
  return `${base || "image"}-${randomBytes(4).toString("hex")}.webp`;
}

/**
 * Downscale (never up) to MAX_DIMENSION on the longest side and re-encode
 * to WebP. `withoutEnlargement` means a small source image passes through
 * at its own size rather than being padded up.
 */
async function optimiseImage(
  buffer: Buffer
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const output = await sharp(buffer)
    .rotate() // apply EXIF orientation, then the tag can be dropped
    .resize({
      width: MAX_DIMENSION,
      height: MAX_DIMENSION,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: output.data,
    width: output.info.width,
    height: output.info.height,
  };
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

  const storage = supabaseAdmin().storage.from(BUCKET);
  const uploaded: string[] = [];

  for (const file of files) {
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
        message: `${file.name} is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is 10 MB.`,
      };
    }

    const filename = safeFilename(file.name);
    const original = Buffer.from(await file.arrayBuffer());

    let optimised;
    try {
      optimised = await optimiseImage(original);
    } catch {
      return { ok: false, message: `${file.name}: couldn't read that as an image.` };
    }

    const { error } = await storage.upload(filename, optimised.buffer, {
      contentType: "image/webp",
      cacheControl: "31536000", // a year — the random suffix means the name never gets reused
    });

    if (error) {
      return { ok: false, message: `Upload failed: ${error.message}` };
    }

    const record = await addMedia({
      url: publicUrl(filename),
      filename: file.name,
      alt: "",
      mimeType: "image/webp",
      sizeBytes: optimised.buffer.byteLength,
      width: optimised.width,
      height: optimised.height,
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
