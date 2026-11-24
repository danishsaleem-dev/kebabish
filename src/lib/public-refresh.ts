import { revalidatePath } from "next/cache";
import { routing } from "@/i18n/routing";

/**
 * How an admin / kitchen action tells the PUBLIC site that something changed.
 *
 * Why this file exists: every page that is regenerated is a metered Vercel ISR
 * write, and these pages are heavy (the homepage is ~2.7 MB across its html /
 * rsc / segment files, a dish page ~1.9 MB; one full regeneration of all ~99
 * pages is ~145 MB). The free plan allows 200K writes a month, so the site can
 * afford very few full regenerations — and `revalidatePath("/", "layout")`
 * marks EVERY page stale, so every visitor or crawler that then lands on a
 * page regenerates it. One careless call per click adds up to the whole month's
 * allowance in days.
 *
 * So pick the narrowest helper that is honest about what changed:
 *   - `refreshWholeSite()`  — something in the header/footer/settings/content, a
 *     dish's price or name, a promotion, a deal. Rare, owner-driven edits.
 *   - `refreshMenuViews()`  — a dish went out of stock / came back, or the order of
 *     the menu changed: home, /menu, /deals and the dish's own page.
 *   - `refreshDishPages()`  — only that dish's page (its recipe, so its allergens).
 *   - nothing at all        — the thing isn't shown publicly (an ingredient's price,
 *     a new unused allergen, a supply). Don't call a helper "just in case".
 *
 * PATH FORMAT MATTERS, and it was checked against a production build: the cache
 * is keyed by the INTERNAL route, which carries the locale — `/nl/menu/x`, not
 * the `/menu/x` a visitor types. `revalidatePath("/menu/x")` silently does
 * nothing here (the proxy rewrites it to `/nl/menu/x`). Home is `/nl` and `/en`.
 *
 * Never throws: `revalidatePath` throws when called during a render (the order
 * confirmation page runs stock bookkeeping), and a failed refresh must never
 * fail the order or the save it follows. The daily window heals a missed one.
 */

const LOCALES: readonly string[] = routing.locales;

function safe(path: string, type?: "layout" | "page"): void {
  try {
    if (type) revalidatePath(path, type);
    else revalidatePath(path);
  } catch {
    // Not in a context that can revalidate; the 24 h window and the next save cover it.
  }
}

/** Everything under both languages. The big hammer — see the note above before reaching for it. */
export function refreshWholeSite(): void {
  safe("/", "layout");
  safe("/en", "layout");
}

/** The dish's own page, in both languages. */
export function refreshDishPages(slugs: Iterable<string>): void {
  for (const slug of new Set(slugs)) {
    for (const l of LOCALES) safe(`/${l}/menu/${slug}`);
  }
}

/**
 * What a dish's availability or a re-ordering of the menu changes: the homepage (popular,
 * categories, help-me-choose), /menu, /deals, plus the given dishes' and deals' own pages.
 * Cards on OTHER dish pages ("you may also like") are left to the daily window — a sold-out
 * badge a little late there is harmless, because the server refuses a sold-out dish anyway.
 */
export function refreshMenuViews(opts: { dishes?: Iterable<string>; deals?: Iterable<string> } = {}): void {
  for (const l of LOCALES) {
    safe(`/${l}`);
    safe(`/${l}/menu`);
    safe(`/${l}/deals`);
  }
  refreshDishPages(opts.dishes ?? []);
  for (const slug of new Set(opts.deals ?? [])) {
    for (const l of LOCALES) safe(`/${l}/deals/${slug}`);
  }
}
