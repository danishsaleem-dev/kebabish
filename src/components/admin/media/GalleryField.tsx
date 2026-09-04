"use client";

import { useState } from "react";
import Image from "next/image";
import { GripVertical, ImagePlus, Star, X } from "lucide-react";
import MediaPickerModal from "@/components/admin/media/MediaPickerModal";
import type { StoredMedia } from "@/lib/admin/store/types";

/**
 * Ordered image gallery for a menu item.
 *
 * The first image is the featured one — that's the whole ordering rule, so
 * reordering is how you change the feature rather than a separate toggle.
 * Drag and drop uses native HTML5 DnD; no dependency needed for a list this
 * small, and there's a keyboard fallback for accessibility.
 */
export default function GalleryField({
  library,
  name = "imageIds",
  initialIds = [],
}: {
  library: StoredMedia[];
  name?: string;
  initialIds?: string[];
}) {
  const [ids, setIds] = useState<string[]>(initialIds);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [overIndex, setOverIndex] = useState<number | null>(null);

  const byId = new Map(library.map((m) => [m.id, m]));
  const selected = ids.flatMap((id) => {
    const media = byId.get(id);
    return media ? [media] : [];
  });

  const move = (from: number, to: number) =>
    setIds((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });

  return (
    <div>
      {/* Submitted with the parent form. */}
      {ids.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}
      {/* Guarantees the field is present even when emptied, so the server can
          tell "no images" apart from "field absent". */}
      <input type="hidden" name={`${name}__present`} value="1" />

      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium text-heading">Gallery</span>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          <ImagePlus size={15} />
          Add images
        </button>
      </div>

      {selected.length === 0 ? (
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-hairline p-8 text-center transition-colors hover:border-ember-500/50 hover:bg-canvas"
        >
          <ImagePlus size={24} className="text-faint" />
          <span className="text-sm font-semibold text-heading">
            No images yet
          </span>
          <span className="text-xs text-muted">
            Choose from the library or upload new ones
          </span>
        </button>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {selected.map((media, index) => (
              <li
                key={media.id}
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(index);
                }}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragIndex !== null) move(dragIndex, index);
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={`group relative overflow-hidden rounded-xl border-2 bg-canvas transition-colors ${
                  overIndex === index && dragIndex !== index
                    ? "border-ember-600"
                    : index === 0
                      ? "border-ember-600/40"
                      : "border-hairline"
                } ${dragIndex === index ? "opacity-50" : ""}`}
              >
                <div className="aspect-square">
                  <Image
                    src={media.url}
                    alt={media.alt || media.filename}
                    width={media.width || 400}
                    height={media.height || 400}
                    className="h-full w-full object-cover"
                  />
                </div>

                {index === 0 && (
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-ember-600 px-2 py-0.5 text-[10px] font-semibold uppercase text-cream-50">
                    <Star size={10} />
                    Featured
                  </span>
                )}

                <span className="absolute right-2 top-2 flex gap-1">
                  <button
                    type="button"
                    onClick={() => setIds((p) => p.filter((x) => x !== media.id))}
                    aria-label={`Remove ${media.filename}`}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-heading/70 text-white opacity-0 transition-opacity hover:bg-danger group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <X size={13} />
                  </button>
                </span>

                <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                  <GripVertical size={14} className="shrink-0 cursor-grab text-faint" />
                  {/* Keyboard fallback — drag and drop alone isn't accessible. */}
                  <span className="flex gap-0.5">
                    <button
                      type="button"
                      onClick={() => move(index, index - 1)}
                      disabled={index === 0}
                      aria-label={`Move ${media.filename} earlier`}
                      className="rounded px-1 text-xs text-muted hover:text-heading disabled:opacity-30"
                    >
                      ←
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, index + 1)}
                      disabled={index === selected.length - 1}
                      aria-label={`Move ${media.filename} later`}
                      className="rounded px-1 text-xs text-muted hover:text-heading disabled:opacity-30"
                    >
                      →
                    </button>
                  </span>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-2 text-xs text-muted">
            Drag to reorder — the first image is the featured one customers see.
          </p>
        </>
      )}

      <MediaPickerModal
        open={pickerOpen}
        media={library}
        multiple
        alreadySelected={ids}
        onClose={() => setPickerOpen(false)}
        onConfirm={(picked) =>
          setIds((prev) => [...prev, ...picked.filter((id) => !prev.includes(id))])
        }
      />
    </div>
  );
}
