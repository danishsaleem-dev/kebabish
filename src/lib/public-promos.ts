import "server-only";
import { readStore } from "@/lib/admin/store";
import { amsterdamDateAhead, amsterdamNow } from "@/lib/delivery-slots";
import { promoRedemptionCounts } from "@/lib/orders";

/**
 * The promotions advertised as a popup on the public site.
 *
 * A promo code appears here only if **all** of this holds: the owner gave it a
 * popup image (an image is what makes a code public — a code without one stays
 * private, e.g. one handed to a single customer), it is switched on, today is
 * inside its start/end dates (Amsterdam's calendar day, same as checkout), and
 * it hasn't been used up. Those are the same rules `validatePromoCode` applies at
 * checkout, so the site never advertises a code the basket would then refuse for
 * being switched off or expired. Per-basket rules (minimum order, "only on
 * kebabs", first-order-only) can't be checked here — there is no basket yet — and
 * are explained at checkout like they always were.
 *
 * Newest first, so when two promotions are running the most recent one leads.
 *
 * Never throws: it renders into every page, and a hiccup in the store must not
 * cost a visitor the website over a promotional popup — it just shows none.
 */
export interface PromoPopup {
  id: string;
  code: string;
  imageUrl: string;
  width: number;
  height: number;
  alt: string;
  /** For the floating promotion widget: what the code is worth. */
  type: "percentage" | "fixed";
  value: number;
  /**
   * The instant the promotion stops (ms since epoch): the **end of its last day in
   * Amsterdam**, because a code with expiry "28 Oct" still works all of the 28th
   * (checkout compares Amsterdam calendar days). Null = it doesn't end.
   */
  endsAt: number | null;
  /**
   * The instant the promotion begins (ms since epoch): the **start of its first day in
   * Amsterdam**. Null = it has already begun / has no start date. A promotion that starts
   * within the next few days is included in the page data *with* this, and the browser
   * decides whether it is live yet (see PromoPopup / PromoWidget) — because the public
   * pages are regenerated rarely now (see `lib/public-refresh.ts`), and a server-side
   * "has it started?" check would be frozen at the moment the page was built.
   */
  startsAt: number | null;
}

/** How far ahead of its start a promotion is put in the page, so a cached page already knows it. */
const LOOKAHEAD_DAYS = 8;

/** Amsterdam's midnight `plusDays` after the start of calendar day `dateKey` (0 = that day begins, 1 = it ends). */
function amsterdamMidnight(dateKey: string, plusDays: number): number | null {
  const [y, m, d] = dateKey.split("-").map(Number);
  if (!y || !m || !d) return null;
  const nextMidnightUtc = Date.UTC(y, m - 1, d + plusDays, 0, 0, 0);
  // What does Amsterdam's wall clock read at that UTC instant? The difference is the offset.
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  }).formatToParts(new Date(nextMidnightUtc));
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const wallAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return nextMidnightUtc - (wallAsUtc - nextMidnightUtc);
}

/** The moment Amsterdam's calendar day `dateKey` ends — i.e. midnight starting the next day. */
const endOfAmsterdamDay = (dateKey: string) => amsterdamMidnight(dateKey, 1);
const startOfAmsterdamDay = (dateKey: string) => amsterdamMidnight(dateKey, 0);

export async function getPromoPopups(): Promise<PromoPopup[]> {
  try {
    const { promoCodes, media } = await readStore();
    const withImage = (promoCodes ?? []).filter((p) => p.imageId && p.active);
    if (withImage.length === 0) return [];

    const today = amsterdamNow().dateKey;
    const horizon = amsterdamDateAhead(LOOKAHEAD_DAYS).dateKey;
    const imageById = new Map((media ?? []).map((m) => [m.id, m]));

    // Only ask the orders table about usage when a candidate actually has a cap.
    const needsCounts = withImage.some((p) => p.maxRedemptions != null);
    const used = needsCounts ? await promoRedemptionCounts() : new Map<string, number>();

    return withImage
      .filter((p) => {
        if (p.startsAt && p.startsAt > horizon) return false; // not for a while: a later page will carry it
        if (p.expiresAt && p.expiresAt < today) return false;
        if (p.maxRedemptions != null && (used.get(p.code) ?? 0) >= p.maxRedemptions) return false;
        return imageById.has(p.imageId!);
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => {
        const image = imageById.get(p.imageId!)!;
        return {
          id: p.id,
          code: p.code,
          imageUrl: image.url,
          // Real dimensions, so the popup reserves the right space and never jumps.
          width: image.width || 800,
          height: image.height || 800,
          alt: image.alt || p.code,
          type: p.type,
          value: p.value,
          endsAt: p.expiresAt ? endOfAmsterdamDay(p.expiresAt) : null,
          // Only worth sending while it is still ahead; once begun, null = "live".
          startsAt: p.startsAt && p.startsAt > today ? startOfAmsterdamDay(p.startsAt) : null,
        };
      });
  } catch (error) {
    console.error("[promo-popup] couldn't load promotions, showing none:", error);
    return [];
  }
}
