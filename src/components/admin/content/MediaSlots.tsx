"use client";

import { useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, RotateCcw, UploadCloud } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { useToast } from "@/components/admin/ui/Toast";
import MediaPickerModal from "@/components/admin/media/MediaPickerModal";
import { createVideoUploadAction } from "@/app/admin/(dashboard)/menu/video-actions";
import {
  saveMediaSlotAction,
  uploadPosterAction,
} from "@/app/admin/(dashboard)/content/actions";
import type { SlotId, SlotValue } from "@/lib/content/model";
import type { StoredMedia } from "@/lib/admin/store/types";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MB, VIDEO_BUCKET, VIDEO_TYPES } from "@/lib/video-config";

export interface SlotView {
  id: SlotId;
  label: string;
  where: string;
  kind: "video" | "image";
  shape: "landscape" | "portrait" | "square";
  advice: string;
  /** What the owner uploaded, or null. */
  override: SlotValue | null;
  /** The file that ships with the site (null if it isn't there). */
  shipped: { video: string | null; poster: string | null; image: string | null };
  /** Explains what an empty slot shows, when it isn't simply the shipped file. */
  followsNote?: string;
}

const ASPECT = { landscape: "aspect-video", portrait: "aspect-[9/16] max-h-80", square: "aspect-square max-h-56" } as const;
const MAX_SECONDS = 60;

type Codec = "h264" | "hevc" | "av1" | "unknown";

/**
 * Which codec an MP4 holds, by looking for its sample-entry tag in the bytes.
 * HEVC ("hvc1"/"hev1") plays in Safari but not in Chrome or Firefox on most
 * phones — a clip that looks fine on the owner's iPhone would show only its
 * still frame to most visitors. That is exactly what happened with the first
 * mobile hero clip, so it is checked before upload rather than discovered live.
 */
function detectCodec(bytes: Uint8Array): Codec {
  const has = (a: number, b: number, c: number, d: number) => {
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === a && bytes[i + 1] === b && bytes[i + 2] === c && bytes[i + 3] === d) return true;
    }
    return false;
  };
  const avc = has(0x61, 0x76, 0x63, 0x31); // avc1
  if (avc) return "h264";
  if (has(0x68, 0x76, 0x63, 0x31) || has(0x68, 0x65, 0x76, 0x31)) return "hevc"; // hvc1 / hev1
  if (has(0x61, 0x76, 0x30, 0x31)) return "av1"; // av01
  return "unknown";
}

/** Read the clip's size and length, and paint its first frame to a JPEG. */
async function inspectVideo(file: File): Promise<{ width: number; height: number; duration: number; frame: Blob }> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement("video");
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto";
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timeout")), 25_000);
      video.onloadeddata = () => {
        clearTimeout(timer);
        resolve();
      };
      video.onerror = () => {
        clearTimeout(timer);
        reject(new Error("unreadable"));
      };
    });
    const width = video.videoWidth;
    const height = video.videoHeight;
    const scale = Math.min(1, 1920 / Math.max(width, height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    canvas.getContext("2d")!.drawImage(video, 0, 0, canvas.width, canvas.height);
    const frame = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", 0.9));
    if (!frame) throw new Error("no frame");
    return { width, height, duration: video.duration, frame };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export default function MediaSlots({ slots, library }: { slots: SlotView[]; library: StoredMedia[] }) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {slots.map((slot) => (
        <SlotCard key={slot.id} slot={slot} library={library} />
      ))}
    </div>
  );
}

function SlotCard({ slot, library }: { slot: SlotView; library: StoredMedia[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const custom = Boolean(slot.override?.video || slot.override?.image);

  async function publish(value: SlotValue | null) {
    const result = await saveMediaSlotAction({ slot: slot.id, value });
    if (!result.ok) {
      toast(result.message ?? "Couldn't save.", "error");
      return false;
    }
    toast(result.message ?? "Saved.", "success");
    router.refresh();
    return true;
  }

  async function handleVideo(file: File) {
    if (!(VIDEO_TYPES as readonly string[]).includes(file.type)) {
      toast("Use an MP4 or WebM video.", "error");
      return;
    }
    if (file.size > MAX_VIDEO_BYTES) {
      toast(`That video is ${(file.size / 1024 / 1024).toFixed(1)} MB — the limit is ${MAX_VIDEO_MB} MB.`, "error");
      return;
    }

    try {
      setBusy("Checking the video…");
      if (file.type === "video/mp4") {
        const codec = detectCodec(new Uint8Array(await file.arrayBuffer()));
        if (codec === "hevc" || codec === "av1") {
          toast(
            `This video is ${codec === "hevc" ? "HEVC (H.265)" : "AV1"}, which many phones and browsers can't play — visitors would only see a still picture. Export it as H.264 MP4 and try again.`,
            "error"
          );
          return;
        }
      }

      let info;
      try {
        info = await inspectVideo(file);
      } catch {
        toast("This browser can't read that video. Try an H.264 MP4.", "error");
        return;
      }

      const aspect = info.width / info.height;
      if (slot.shape === "landscape" && aspect < 1.2) {
        toast("This video is tall, but this spot needs a wide (landscape) one.", "error");
        return;
      }
      if (slot.shape === "portrait" && aspect > 0.85) {
        toast("This video is wide, but this spot needs a tall (portrait) one.", "error");
        return;
      }
      if (info.duration > MAX_SECONDS) {
        toast(`That clip is ${Math.round(info.duration)} seconds — keep it under ${MAX_SECONDS}. Short loops (5–20 s) work best.`, "error");
        return;
      }
      if (Math.min(info.width, info.height) < 540) {
        toast("This video is low resolution and may look blurry on large screens.", "info");
      }

      // The still shown while the clip loads is the clip's own first frame, so
      // nothing visibly jumps when playback starts.
      setBusy("Making the still frame…");
      const posterForm = new FormData();
      posterForm.set("file", new File([info.frame], "poster.jpg", { type: "image/jpeg" }));
      const poster = await uploadPosterAction(posterForm);
      if (!poster.ok) {
        toast(poster.message, "error");
        return;
      }

      setBusy("Uploading the video…");
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

      setBusy("Publishing…");
      await publish({ video: ticket.publicUrl, poster: poster.url });
    } catch {
      toast("Upload failed — check your connection and try again.", "error");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function reset() {
    if (!window.confirm("Go back to the original? The file you uploaded will be removed.")) return;
    setBusy("Resetting…");
    try {
      await publish(null);
    } finally {
      setBusy(null);
    }
  }

  const shownVideo = slot.override?.video ?? slot.shipped.video;
  const shownPoster = slot.override?.poster ?? slot.shipped.poster;
  const shownImage = slot.override?.image ?? slot.shipped.image;

  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h2 className="font-display text-lg font-semibold text-heading">{slot.label}</h2>
          <p className="mt-0.5 text-sm text-muted">{slot.where}</p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
            custom ? "bg-ember-600/10 text-ember-700" : "bg-canvas text-muted"
          }`}
        >
          {custom ? "Your upload" : "Original"}
        </span>
      </div>

      <div className="mt-4 grid items-start gap-5 md:grid-cols-[minmax(0,18rem)_1fr]">
        <div className={`${ASPECT[slot.shape]} w-full overflow-hidden rounded-xl bg-charcoal-900`}>
          {slot.kind === "video" ? (
            shownVideo ? (
              <video
                key={shownVideo}
                src={shownVideo}
                poster={shownPoster ?? undefined}
                controls
                muted
                playsInline
                preload="metadata"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center p-4 text-center text-xs text-cream-200/60">
                No video — the page shows its still picture.
              </div>
            )
          ) : shownImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={shownImage} alt="" className="h-full w-full object-cover" />
          ) : null}
        </div>

        <div className="min-w-0">
          <p className="text-sm text-body-text">{slot.advice}</p>
          {!custom && slot.followsNote && <p className="mt-2 text-sm text-muted">{slot.followsNote}</p>}
          {slot.kind === "video" && (
            <p className="mt-2 text-xs text-muted">
              MP4 (H.264) or WebM · up to {MAX_VIDEO_MB} MB · no sound needed. The still picture shown while it loads is
              made from the first frame automatically.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {slot.kind === "video" ? (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
                {busy ?? (custom ? "Replace video" : "Upload a video")}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setPicking(true)}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
                {busy ?? (custom ? "Choose a different photo" : "Choose a photo")}
              </button>
            )}
            {custom && (
              <button
                type="button"
                onClick={reset}
                disabled={Boolean(busy)}
                className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas disabled:opacity-60"
              >
                <RotateCcw size={15} />
                Go back to the original
              </button>
            )}
          </div>
        </div>
      </div>

      {slot.kind === "video" && (
        <input
          ref={fileRef}
          type="file"
          accept={VIDEO_TYPES.join(",")}
          className="sr-only"
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleVideo(file);
          }}
        />
      )}

      {slot.kind === "image" && (
        <MediaPickerModal
          open={picking}
          media={library}
          onClose={() => setPicking(false)}
          onConfirm={async (ids) => {
            const chosen = library.find((m) => m.id === ids[0]);
            setPicking(false);
            if (!chosen) return;
            setBusy("Publishing…");
            try {
              await publish({ image: chosen.url });
            } finally {
              setBusy(null);
            }
          }}
        />
      )}
    </Card>
  );
}
