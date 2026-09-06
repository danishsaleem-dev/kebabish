"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, UploadCloud } from "lucide-react";
import { uploadMediaAction } from "@/app/admin/(dashboard)/media/actions";
import { useToast } from "@/components/admin/ui/Toast";

/**
 * Drop-zone / file picker.
 *
 * Dimensions aren't measured here — the server re-encodes every upload
 * through sharp anyway (resize + WebP), so the dimensions it records are
 * the real post-resize ones, not whatever the original happened to be.
 */
export default function MediaUploader({
  onUploaded,
  compact = false,
}: {
  onUploaded?: () => void;
  compact?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragging, setDragging] = useState(false);
  const [pending, startTransition] = useTransition();
  const { toast } = useToast();

  const send = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith("image/"));
    if (files.length === 0) {
      toast("Those files aren't images.", "error");
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      for (const file of files) {
        formData.append("files", file);
      }

      const result = await uploadMediaAction({ ok: false }, formData);
      toast(
        result.message ?? (result.ok ? "Uploaded." : "Upload failed."),
        result.ok ? "success" : "error"
      );
      if (result.ok) onUploaded?.();
    });
  };

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          send(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed text-center transition-colors ${
          compact ? "gap-1 p-5" : "gap-2 p-8"
        } ${
          dragging
            ? "border-ember-500 bg-ember-600/5"
            : "border-hairline hover:border-ember-500/50 hover:bg-canvas"
        }`}
      >
        {pending ? (
          <Loader2 size={compact ? 20 : 26} className="animate-spin text-ember-600" />
        ) : (
          <UploadCloud size={compact ? 20 : 26} className="text-faint" />
        )}
        <p className="text-sm font-semibold text-heading">
          {pending ? "Uploading…" : "Drop images here"}
        </p>
        {!compact && (
          <p className="text-xs text-muted">
            or click to browse · JPEG, PNG, WebP or AVIF · up to 10 MB each ·
            automatically optimized
          </p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/avif"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) send(e.target.files);
          e.target.value = "";
        }}
      />


    </div>
  );
}
