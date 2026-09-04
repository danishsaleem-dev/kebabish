"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Check, ImageOff, Search, X } from "lucide-react";
import MediaUploader from "@/components/admin/media/MediaUploader";
import type { StoredMedia } from "@/lib/admin/store/types";

/**
 * The shared "choose from library" modal. Every image field on the panel opens
 * this, so there's one place images are browsed and one place they're uploaded.
 */
interface PickerProps {
  media: StoredMedia[];
  multiple?: boolean;
  alreadySelected?: string[];
  onClose: () => void;
  onConfirm: (ids: string[]) => void;
}

/**
 * Thin open/closed wrapper. The body is a separate component that only mounts
 * while open, so its selection state is naturally fresh each time — no effect
 * resetting state after the fact.
 */
export default function MediaPickerModal({
  open,
  ...props
}: PickerProps & { open: boolean }) {
  if (!open) return null;
  return <PickerBody {...props} />;
}

function PickerBody({
  media,
  multiple = false,
  alreadySelected = [],
  onClose,
  onConfirm,
}: PickerProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return media;
    return media.filter(
      (m) =>
        m.filename.toLowerCase().includes(q) ||
        m.alt.toLowerCase().includes(q)
    );
  }, [media, query]);

  const toggle = (id: string) =>
    setPicked((prev) =>
      multiple
        ? prev.includes(id)
          ? prev.filter((x) => x !== id)
          : [...prev, id]
        : [id]
    );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close library"
        onClick={onClose}
        className="absolute inset-0 bg-heading/50 backdrop-blur-[2px]"
      />

      <div className="relative flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-hairline bg-panel shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-hairline p-5">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Media library
            </h2>
            <p className="mt-0.5 text-sm text-muted">
              {multiple
                ? "Pick one or more images. They're added in the order you click them."
                : "Pick an image."}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:bg-canvas"
          >
            <X size={19} />
          </button>
        </div>

        <div className="border-b border-hairline p-5">
          <MediaUploader compact onUploaded={() => router.refresh()} />
          <label className="relative mt-3 block">
            <span className="sr-only">Search library</span>
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by filename or alt text…"
              className="h-10 w-full rounded-lg border border-hairline bg-panel pl-9 pr-3 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <ImageOff size={26} className="text-faint" />
              <p className="text-sm text-muted">
                {media.length === 0
                  ? "Nothing in the library yet — upload your first image above."
                  : "No images match that search."}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {rows.map((item) => {
                const order = picked.indexOf(item.id);
                const inUse = alreadySelected.includes(item.id);

                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item.id)}
                      className={`group relative block w-full overflow-hidden rounded-xl border-2 transition-colors ${
                        order > -1
                          ? "border-ember-600"
                          : "border-transparent hover:border-hairline"
                      }`}
                    >
                      <span className="block aspect-square bg-canvas">
                        <Image
                          src={item.url}
                          alt={item.alt || item.filename}
                          width={item.width || 400}
                          height={item.height || 400}
                          className="h-full w-full object-cover"
                        />
                      </span>

                      {order > -1 && (
                        <span className="absolute right-2 top-2 flex h-6 min-w-6 items-center justify-center rounded-full bg-ember-600 px-1.5 text-xs font-semibold text-cream-50">
                          {multiple ? order + 1 : <Check size={13} />}
                        </span>
                      )}

                      {inUse && order === -1 && (
                        <span className="absolute left-2 top-2 rounded bg-heading/75 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
                          in use
                        </span>
                      )}

                      <span className="block truncate px-2 py-1.5 text-left text-xs text-muted">
                        {item.filename}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-hairline p-5">
          <p className="text-sm text-muted">
            {picked.length > 0
              ? `${picked.length} selected`
              : `${media.length} image${media.length === 1 ? "" : "s"} in library`}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={picked.length === 0}
              onClick={() => {
                onConfirm(picked);
                onClose();
              }}
              className="rounded-lg bg-ember-600 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-50"
            >
              {multiple ? "Add selected" : "Use image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
