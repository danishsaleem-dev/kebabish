/**
 * How a title and description will read in a Google result, with the length
 * guidance next to it. Google truncates by pixel width rather than characters,
 * so these are the usual rules of thumb, not a guarantee.
 */
export const TITLE_GOOD = 60;
export const TITLE_MAX = 70;
export const DESC_MIN = 110;
export const DESC_GOOD_MAX = 160;
export const DESC_MAX = 180;

export function seoTone(kind: "title" | "description", length: number): "good" | "warn" | "bad" {
  if (kind === "title") return length === 0 ? "bad" : length <= TITLE_GOOD ? "good" : length <= TITLE_MAX ? "warn" : "bad";
  return length < 60
    ? "bad"
    : length >= DESC_MIN && length <= DESC_GOOD_MAX
      ? "good"
      : length < DESC_MIN || length <= DESC_MAX
        ? "warn"
        : "bad";
}

const TONE_TEXT = { good: "text-success", warn: "text-warn", bad: "text-danger" } as const;

export function SeoCounter({ kind, length }: { kind: "title" | "description"; length: number }) {
  const tone = seoTone(kind, length);
  const guide = kind === "title" ? `aim for up to ${TITLE_GOOD}` : `aim for ${DESC_MIN}–${DESC_GOOD_MAX}`;
  return (
    <span className={`text-xs font-medium ${TONE_TEXT[tone]}`}>
      {length} characters · {guide}
    </span>
  );
}

export default function SeoPreview({
  title,
  description,
  suffix,
}: {
  title: string;
  description: string;
  /** The homepage title always ends with “ | Kebabish”. */
  suffix?: string;
}) {
  const shownTitle = `${title}${suffix ?? ""}`;
  return (
    <div className="rounded-xl border border-hairline bg-panel p-3.5">
      <p className="text-[0.7rem] font-semibold uppercase tracking-wide text-faint">Google preview</p>
      <p className="mt-1.5 truncate text-xs text-muted">www.kebabish.nl</p>
      <p className="mt-0.5 line-clamp-2 text-[1.05rem] leading-snug text-[#1a0dab]">
        {shownTitle || "Page title"}
      </p>
      <p className="mt-1 line-clamp-3 text-sm leading-snug text-body-text">
        {description || "The page description appears here."}
      </p>
    </div>
  );
}
