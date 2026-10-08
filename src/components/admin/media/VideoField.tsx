"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { Film, Loader2, Trash2, UploadCloud } from "lucide-react";
import { createVideoUploadAction } from "@/app/admin/(dashboard)/menu/video-actions";
import { useToast } from "@/components/admin/ui/Toast";
import {
  MAX_VIDEO_BYTES,
  MAX_VIDEO_MB,
  VIDEO_BUCKET,
  VIDEO_TYPES,
} from "@/lib/video-config";

/**
 * One optional video per dish. Submits as a single hidden `videoUrl` field
 * inside the item form, so it saves with everything else on Save.
 *
 * The file never passes through our server: the action only mints a
 * signed upload URL, and the browser sends the bytes straight to Supabase
 * Storage (a server action would hit Vercel's ~4.5 MB request cap).
 */
export default function VideoField({ initialUrl }: { initialUrl: string }) {
  const [url, setUrl] = useState(initialUrl);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Block the surrounding form's Save while bytes are still in flight —
  // otherwise it would save with no video and the upload would finish
  // against a dish that has already been saved without it.
  useEffect(() => {
    inputRef.current?.setCustomValidity(
      uploading ? "Wait for the video to finish uploading, then save." : ""
    );
  }, [uploading]);

  async function handleFile(file: File) {
    if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) {
      toast("Use an MP4 or WebM video.", "error");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast(
        `That video is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_VIDEO_MB} MB.`,
        "error"
      );
      return;
    }

    setUploading(true);
    try {
      const ticket = await createVideoUploadAction({
        filename: file.name,
        contentType: file.type,
        size: file.size,
      });
      if (!ticket.ok) {
        toast(ticket.message, "error");
        return;
      }

      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { error } = await supabase.storage
        .from(VIDEO_BUCKET)
        .uploadToSignedUrl(ticket.path, ticket.token, file, {
          contentType: file.type,
          cacheControl: "31536000",
        });

      if (error) {
        toast(`Upload failed: ${error.message}`, "error");
        return;
      }

      setUrl(ticket.publicUrl);
      toast("Video uploaded — save the dish to publish it.", "success");
    } catch {
      toast("Upload failed — check your connection and try again.", "error");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input type="hidden" name="videoUrl" value={url} />

      {url ? (
        <div className="space-y-3">
          <video
            src={url}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-black"
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas disabled:opacity-60"
            >
              {uploading ? (
                <Loader2 size={15} className="animate-spin" />
              ) : (
                <UploadCloud size={15} />
              )}
              {uploading ? "Uploading…" : "Replace video"}
            </button>
            <button
              type="button"
              onClick={() => setUrl("")}
              disabled={uploading}
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-3.5 py-2 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft disabled:opacity-60"
            >
              <Trash2 size={15} />
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-hairline p-8 text-center transition-colors hover:border-ember-500/50 hover:bg-canvas disabled:opacity-70"
        >
          {uploading ? (
            <Loader2 size={26} className="animate-spin text-ember-600" />
          ) : (
            <Film size={26} className="text-faint" />
          )}
          <span className="text-sm font-semibold text-heading">
            {uploading ? "Uploading…" : "Upload a video"}
          </span>
          <span className="text-xs text-muted">
            MP4 or WebM · up to {MAX_VIDEO_MB} MB · short clips (5–20 seconds)
            work best
          </span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={VIDEO_TYPES.join(",")}
        className="sr-only"
        tabIndex={-1}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <p className="mt-3 text-xs text-muted">
        Plays on the dish&apos;s page, starting only when a customer presses play.
        Use H.264 MP4 for the widest phone support.
      </p>
    </div>
  );
}
