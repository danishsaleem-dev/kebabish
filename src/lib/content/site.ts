import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";
import { getContent } from "@/lib/content/store";
import {
  LAYOUT_KEY,
  REVIEWS_KEY,
} from "@/lib/content/registry";
import {
  MEDIA_SLOTS,
  SLOT_BY_ID,
  mediaKey,
  resolveLayout,
  type LayoutEntry,
  type SlotId,
  type SlotValue,
} from "@/lib/content/model";
import { reviews as shippedReviews, type Review } from "@/lib/reviews-data";

/**
 * What the public site asks for beyond text: the homepage's section order, the
 * video and image slots, and the reviews list. Each one answers with what the
 * owner chose, or with what ships in the repo when he hasn't chosen anything —
 * and never throws (see `getContent`).
 */

// ---------------------------------------------------------------------------
// Homepage layout
// ---------------------------------------------------------------------------

export async function getHomeLayout(): Promise<LayoutEntry[]> {
  const { shared } = await getContent();
  return resolveLayout(shared[LAYOUT_KEY]);
}

// ---------------------------------------------------------------------------
// Media slots
// ---------------------------------------------------------------------------

/** A clip the page can play, and the still shown until (or instead of) it. */
export interface VideoMedia {
  /** null when there is no clip at all — the page then shows only its still. */
  video: string | null;
  poster: string;
}

export interface SiteMedia {
  heroWeb: VideoMedia;
  heroMobile: VideoMedia;
  story: VideoMedia;
  aboutBanner: VideoMedia;
  storyDetail: { image: string };
}

/** Bundled files are checked on disk so a missing one never ships a `<video>` that 404s. */
function bundled(publicPath: string | undefined): string | null {
  if (!publicPath) return null;
  return existsSync(path.join(process.cwd(), "public", publicPath)) ? publicPath : null;
}

function stored(shared: Record<string, unknown>, id: SlotId): SlotValue {
  const value = shared[mediaKey(id)];
  return value && typeof value === "object" ? (value as SlotValue) : {};
}

function resolveVideo(shared: Record<string, unknown>, id: SlotId): VideoMedia {
  const fallback = SLOT_BY_ID.get(id)!.fallback;
  const chosen = stored(shared, id);
  if (typeof chosen.video === "string" && chosen.video) {
    return {
      video: chosen.video,
      poster: typeof chosen.poster === "string" && chosen.poster ? chosen.poster : (fallback.poster ?? ""),
    };
  }
  return { video: bundled(fallback.video), poster: fallback.poster ?? "" };
}

export async function getSiteMedia(): Promise<SiteMedia> {
  const { shared } = await getContent();

  const heroWeb = resolveVideo(shared, "heroWeb");
  const heroMobile = resolveVideo(shared, "heroMobile");

  // The About banner follows the homepage's widescreen clip unless it has a
  // clip of its own; the vertical one is the last resort.
  const ownBanner = stored(shared, "aboutBanner");
  const aboutBanner: VideoMedia =
    typeof ownBanner.video === "string" && ownBanner.video
      ? {
          video: ownBanner.video,
          poster: typeof ownBanner.poster === "string" && ownBanner.poster ? ownBanner.poster : heroWeb.poster,
        }
      : heroWeb.video
        ? heroWeb
        : heroMobile;

  const detail = stored(shared, "storyDetail");
  const detailFallback = SLOT_BY_ID.get("storyDetail")!.fallback.image!;

  return {
    heroWeb,
    heroMobile,
    story: resolveVideo(shared, "story"),
    aboutBanner,
    storyDetail: {
      image: typeof detail.image === "string" && detail.image ? detail.image : detailFallback,
    },
  };
}

/** Which slots currently use something the owner uploaded (for the admin screen). */
export function overriddenSlots(shared: Record<string, unknown>): SlotId[] {
  return MEDIA_SLOTS.filter((s) => {
    const v = stored(shared, s.id);
    return Boolean(v.video || v.image);
  }).map((s) => s.id);
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

/** A stored reviews list, cleaned; null when there is no usable one. */
export function cleanReviews(value: unknown): Review[] | null {
  if (!Array.isArray(value)) return null;
  const out: Review[] = [];
  for (const r of value) {
    if (typeof r?.name !== "string" || typeof r?.text !== "string") continue;
    const rating = Math.round(Number(r.rating));
    if (!(rating >= 1 && rating <= 5)) continue;
    out.push({
      name: r.name,
      text: r.text,
      rating: rating as Review["rating"],
      ...(typeof r.source === "string" && r.source ? { source: r.source } : {}),
    });
  }
  return out;
}

/**
 * The reviews shown on the site. Once the owner has saved a list it IS the list
 * (so he can remove a review as well as add one); until then it's the list that
 * ships in `reviews-data.ts`, which is empty.
 */
export async function getReviews(): Promise<Review[]> {
  const { shared } = await getContent();
  return cleanReviews(shared[REVIEWS_KEY]) ?? shippedReviews;
}

/**
 * What a slot shows when nothing has been uploaded: the files that ship with the
 * site, checked on disk. For the admin screen, which shows "the original" next
 * to the owner's own upload.
 */
export function shippedSlot(id: SlotId): { video: string | null; poster: string | null; image: string | null } {
  const f = SLOT_BY_ID.get(id)!.fallback;
  return {
    video: bundled(f.video),
    poster: f.poster ?? null,
    image: f.image ?? null,
  };
}
