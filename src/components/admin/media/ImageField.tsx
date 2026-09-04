"use client";

import { useState } from "react";
import Image from "next/image";
import { ImagePlus, X } from "lucide-react";
import MediaPickerModal from "@/components/admin/media/MediaPickerModal";
import type { StoredMedia } from "@/lib/admin/store/types";

/** Single featured image picker — used for categories. */
export default function ImageField({
  library,
  name = "imageId",
  initialId,
  label = "Featured image",
  hint,
}: {
  library: StoredMedia[];
  name?: string;
  initialId?: string;
  label?: string;
  hint?: string;
}) {
  const [id, setId] = useState<string | undefined>(initialId);
  const [open, setOpen] = useState(false);

  const media = library.find((m) => m.id === id);

  return (
    <div>
      {/* Always submitted, so clearing the field actually clears it. */}
      <input type="hidden" name={name} value={id ?? ""} />

      <span className="mb-1.5 block text-sm font-medium text-heading">
        {label}
      </span>

      {media ? (
        <div className="flex items-center gap-3 rounded-xl border border-hairline p-3">
          <span className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-canvas">
            <Image
              src={media.url}
              alt={media.alt || media.filename}
              width={media.width || 200}
              height={media.height || 200}
              className="h-full w-full object-cover"
            />
          </span>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-heading">
              {media.filename}
            </p>
            <p className="truncate text-xs text-muted">
              {media.alt || "No alt text set"}
            </p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-1.5 text-xs font-semibold text-ember-600 hover:underline"
            >
              Replace
            </button>
          </div>

          <button
            type="button"
            onClick={() => setId(undefined)}
            aria-label="Remove image"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-hairline p-6 text-center transition-colors hover:border-ember-500/50 hover:bg-canvas"
        >
          <ImagePlus size={22} className="text-faint" />
          <span className="text-sm font-semibold text-heading">
            Choose an image
          </span>
          <span className="text-xs text-muted">
            From the library, or upload a new one
          </span>
        </button>
      )}

      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}

      <MediaPickerModal
        open={open}
        media={library}
        alreadySelected={id ? [id] : []}
        onClose={() => setOpen(false)}
        onConfirm={(picked) => setId(picked[0])}
      />
    </div>
  );
}
