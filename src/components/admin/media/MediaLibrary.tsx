"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ImageOff, Info, Search, Trash2, X } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import Dropdown from "@/components/admin/ui/Dropdown";
import MediaUploader from "@/components/admin/media/MediaUploader";
import { Input, SubmitButton } from "@/components/admin/ui/Form";
import {
  deleteMediaAction,
  updateMediaAltAction,
} from "@/app/admin/(dashboard)/media/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredMedia } from "@/lib/admin/store/types";
import { useToast } from "@/components/admin/ui/Toast";

const EMPTY: FormState = { ok: false };
type SortKey = "newest" | "oldest" | "largest" | "name";

function formatBytes(bytes: number) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

export default function MediaLibrary({
  media,
  usage,
}: {
  media: StoredMedia[];
  /** media id -> where it's used, for the detail panel and delete warnings. */
  usage: Record<string, string[]>;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("newest");
  const [openId, setOpenId] = useState<string | null>(null);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? media.filter(
          (m) =>
            m.filename.toLowerCase().includes(q) ||
            m.alt.toLowerCase().includes(q)
        )
      : media;

    return [...filtered].sort((a, b) => {
      if (sort === "oldest") return a.uploadedAt.localeCompare(b.uploadedAt);
      if (sort === "largest") return b.sizeBytes - a.sizeBytes;
      if (sort === "name") return a.filename.localeCompare(b.filename);
      return b.uploadedAt.localeCompare(a.uploadedAt);
    });
  }, [media, query, sort]);

  const totalBytes = media.reduce((sum, m) => sum + m.sizeBytes, 0);
  const open = media.find((m) => m.id === openId) ?? null;

  return (
    <>
      <Card>
        <MediaUploader onUploaded={() => router.refresh()} />
      </Card>

      <Card padded={false}>
        <div className="flex flex-wrap items-center justify-between gap-3 p-5 sm:p-6">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Library
            </h2>
            <p className="mt-1 text-sm text-muted">
              {rows.length} of {media.length} image
              {media.length === 1 ? "" : "s"} · {formatBytes(totalBytes)} total
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <label className="relative">
              <span className="sr-only">Search library</span>
              <Search
                size={16}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint"
              />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search images…"
                className="h-10 w-48 rounded-lg border border-hairline bg-panel pl-9 pr-3 text-sm text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none"
              />
            </label>
            <Dropdown
              label="Sort"
              value={sort}
              onChange={setSort}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
                { value: "largest", label: "Largest first" },
                { value: "name", label: "Filename A–Z" },
              ]}
            />
          </div>
        </div>

        <div className="border-t border-hairline p-5 sm:p-6">
          {rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <ImageOff size={26} className="text-faint" />
              <p className="text-sm text-muted">
                {media.length === 0
                  ? "Nothing uploaded yet."
                  : "No images match that search."}
              </p>
            </div>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {rows.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    onClick={() => setOpenId(item.id)}
                    className="group block w-full overflow-hidden rounded-xl border border-hairline text-left transition-shadow hover:shadow-md"
                  >
                    <span className="block aspect-square bg-canvas">
                      <Image
                        src={item.url}
                        alt={item.alt || item.filename}
                        width={item.width || 400}
                        height={item.height || 400}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </span>
                    <span className="block px-3 py-2">
                      <span className="block truncate text-sm font-medium text-heading">
                        {item.filename}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {item.width}×{item.height} · {formatBytes(item.sizeBytes)}
                      </span>
                      {!item.alt && (
                        <span className="mt-1 inline-flex items-center gap-1 text-[10px] font-semibold uppercase text-warn">
                          <Info size={10} />
                          No alt text
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {open && (
        <DetailPanel
          media={open}
          usedBy={usage[open.id] ?? []}
          onClose={() => setOpenId(null)}
        />
      )}
    </>
  );
}

function DetailPanel({
  media,
  usedBy,
  onClose,
}: {
  media: StoredMedia;
  usedBy: string[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [altState, altAction] = useActionState(updateMediaAltAction, EMPTY);
  const [delState, delAction] = useActionState(deleteMediaAction, EMPTY);
  const [confirming, setConfirming] = useState(false);
  const { toast } = useToast();

  const seenRef = useRef<FormState[]>([]);
  useEffect(() => {
    for (const state of [altState, delState]) {
      if (!state.message || seenRef.current.includes(state)) continue;
      seenRef.current.push(state);
      toast(state.message, state.ok ? "success" : "error");
      if (state.ok && state === delState) onClose();
    }
  }, [altState, delState, toast, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-heading/50 backdrop-blur-[2px]"
      />

      <div className="relative grid max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-2xl border border-hairline bg-panel shadow-2xl sm:grid-cols-2">
        <div className="bg-canvas">
          <Image
            src={media.url}
            alt={media.alt || media.filename}
            width={media.width || 800}
            height={media.height || 800}
            className="h-full max-h-[40vh] w-full object-contain sm:max-h-none"
          />
        </div>

        <div className="flex flex-col overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="min-w-0 break-words font-display text-base font-semibold text-heading">
              {media.filename}
            </h3>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted hover:bg-canvas"
            >
              <X size={17} />
            </button>
          </div>

          <dl className="mt-4 space-y-1.5 text-sm">
            <Row label="Dimensions" value={`${media.width}×${media.height}`} />
            <Row label="Size" value={formatBytes(media.sizeBytes)} />
            <Row label="Type" value={media.mimeType.replace("image/", "")} />
            <Row
              label="Uploaded"
              value={new Date(media.uploadedAt).toLocaleDateString("en-GB", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            />
          </dl>

          <form action={altAction} className="mt-5">
            <input type="hidden" name="id" value={media.id} />
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-heading">
                Alt text
              </span>
              <Input
                name="alt"
                defaultValue={media.alt}
                placeholder="Chicken biryani on a copper platter"
              />
            </label>
            <p className="mt-1 text-xs text-muted">
              Describes the image for screen readers and search engines.
            </p>
            <div className="mt-3">
              <SubmitButton>Save alt text</SubmitButton>
            </div>

          </form>

          <div className="mt-6 border-t border-hairline pt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              Used by
            </p>
            {usedBy.length === 0 ? (
              <p className="mt-1.5 text-sm text-muted">
                Not used anywhere — safe to delete.
              </p>
            ) : (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {usedBy.map((name) => (
                  <li
                    key={name}
                    className="rounded-full border border-hairline px-2.5 py-1 text-xs text-body-text"
                  >
                    {name}
                  </li>
                ))}
              </ul>
            )}

            <form
              action={delAction}
              className="mt-4"
              onSubmit={() => setTimeout(() => router.refresh(), 400)}
            >
              <input type="hidden" name="id" value={media.id} />
              {confirming && <input type="hidden" name="force" value="true" />}
              <button
                type="submit"
                onClick={() => setConfirming(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
              >
                <Trash2 size={15} />
                {confirming ? "Confirm delete" : "Delete image"}
              </button>

            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium text-heading">{value}</dd>
    </div>
  );
}
