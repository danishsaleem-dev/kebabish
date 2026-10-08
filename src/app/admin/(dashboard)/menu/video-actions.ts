"use server";

import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { supabaseAdmin } from "@/lib/supabase/server";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  VIDEO_BUCKET,
  VIDEO_TYPES,
} from "@/lib/video-config";

export type VideoUploadTicket =
  | { ok: true; path: string; token: string; publicUrl: string }
  | { ok: false; message: string };

/**
 * Hands the browser a one-shot signed upload URL so the video goes straight
 * to Supabase Storage. It can't go through a server action like images do:
 * Vercel caps a function's request body at ~4.5 MB and a dish video is
 * several times that.
 *
 * Because this mints upload capability, it checks the session itself
 * rather than leaning on the page-level guard — server actions are
 * callable on their own.
 */
export async function createVideoUploadAction(input: {
  filename: string;
  contentType: string;
  size: number;
}): Promise<VideoUploadTicket> {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager") {
    return { ok: false, message: "Sign in again to upload." };
  }

  if (!(VIDEO_TYPES as readonly string[]).includes(input.contentType)) {
    return { ok: false, message: "Only MP4 or WebM videos are supported." };
  }
  if (input.size > MAX_VIDEO_BYTES) {
    return {
      ok: false,
      message: `That video is ${(input.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_VIDEO_MB} MB.`,
    };
  }

  const base =
    input.filename
      .replace(/\.[^.]+$/, "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "video";
  const ext = input.contentType === "video/webm" ? "webm" : "mp4";
  // Random suffix so a re-upload never overwrites (and never serves stale
  // cached bytes under the same name).
  const path = `${base}-${randomBytes(4).toString("hex")}.${ext}`;

  const { data, error } = await supabaseAdmin()
    .storage.from(VIDEO_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return { ok: false, message: `Couldn't start the upload: ${error?.message ?? "unknown error"}` };
  }

  return {
    ok: true,
    path: data.path,
    token: data.token,
    publicUrl: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/${data.path}`,
  };
}
