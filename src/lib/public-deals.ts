import { dealWasCents } from "@/lib/deals";
import { fromCents, isSellablePrice, toCents } from "@/lib/money";
import { readWithStock, toPublicItem, type PublicMenuItem } from "@/lib/public-menu";
import type { StoredDeal, StoreShape } from "@/lib/admin/store/types";
import type { StockMap } from "@/lib/stock";

/** Deals as the public site shows them. Like the menu, reading never takes a page down. */

export interface PublicDealChoice {
  slug: string;
  name: string;
  portion: string;
  image?: string;
  /** Menu price of one portion. */
  price: number;
  soldOut: boolean;
}

export interface PublicDealSlot {
  id: string;
  /** The heading of a choice ("Kies je drankje"); empty on a fixed part. */
  label: string;
  quantity: number;
  /** Every dish in this part, even one that can't be ordered today. */
  itemSlugs: string[];
  /** The ones the page can show: priced and on the menu. */
  choices: PublicDealChoice[];
  removable: boolean;
  removeCredit: number;
}

export interface PublicDeal {
  slug: string;
  name: string;
  description: string;
  /** False on /en when the description is the Dutch fallback. */
  descriptionTranslated: boolean;
  /** The deal's own photo, else the first dish photo. */
  image?: string;
  /**
   * The deal's picture, as one entry — its own uploaded photo, or one dish's standing in
   * when it has none. Never several: a card shows `images[0]`.
   */
  images: string[];
  price: number;
  /** What the parts cost separately, each at its cheapest choice. */
  wasPrice: number;
  saving: number;
  savingPercent: number;
  slots: PublicDealSlot[];
  minItems: number;
  /** Can't be ordered as it stands: a part that must stay has nothing left to serve. */
  soldOut: boolean;
  allergens: { id: string; label: string }[];
  mayContain: { id: string; label: string }[];
}

const pick = (locale: string, base: string, english?: string) =>
  locale === "en" && english?.trim() ? english : base;

function toPublicDeal(deal: StoredDeal, data: StoreShape, stock: StockMap | null, locale: string): PublicDeal {
  const dish = new Map<string, PublicMenuItem>();
  for (const slot of deal.slots) {
    for (const slug of slot.itemSlugs) {
      const item = data.items.find((i) => i.slug === slug);
      const category = item && data.categories.find((c) => c.id === item.categoryId);
      if (item?.visible && category?.visible) {
        dish.set(slug, toPublicItem(item, data.optionGroups ?? [], data, locale, stock));
      }
    }
  }

  const slots = deal.slots.map((slot): PublicDealSlot => ({
    id: slot.id,
    label: slot.itemSlugs.length > 1 ? pick(locale, slot.label ?? "", slot.labelEn) : "",
    quantity: slot.quantity,
    itemSlugs: slot.itemSlugs,
    removable: slot.removable,
    removeCredit: slot.removeCredit,
    choices: slot.itemSlugs.flatMap((slug) => {
      const item = dish.get(slug);
      return item && item.price != null
        ? [{ slug, name: item.name, portion: item.portion, image: item.image, price: item.price, soldOut: item.soldOut }]
        : [];
    }),
  }));

  const priceOf = (slug: string) => {
    const price = dish.get(slug)?.price;
    return isSellablePrice(price) ? toCents(price) : null;
  };
  const wasPrice = fromCents(dealWasCents(deal, priceOf));
  const saving = Math.max(wasPrice - deal.price, 0);

  const canServe = (s: PublicDealSlot) => s.choices.some((c) => !c.soldOut);
  const served = slots.filter(canServe).length;
  const soldOut = slots.some((s) => !s.removable && !canServe(s)) || served < Math.max(deal.minItems, 1);

  // The deal's own photo is the deal's photo, full stop: when there is one it is the only
  // one, so nothing of the dishes inside is mixed into it. Without one, the first dish photo
  // stands in — one picture, never a collage of them (Danish's call, Nov 2026).
  const own = deal.imageId ? (data.media ?? []).find((m) => m.id === deal.imageId)?.url : undefined;
  const images = own
    ? [own]
    : [...new Set(slots.flatMap((s) => (s.choices[0]?.image ? [s.choices[0].image] : [])))].slice(0, 1);

  const allergens = new Map([...dish.values()].flatMap((i) => i.allergens).map((a) => [a.id, a]));
  const mayContain = new Map(
    [...dish.values()].flatMap((i) => i.mayContain).filter((a) => !allergens.has(a.id)).map((a) => [a.id, a])
  );

  return {
    slug: deal.slug,
    name: pick(locale, deal.name, deal.nameEn),
    description: pick(locale, deal.description, deal.descriptionEn),
    descriptionTranslated: locale !== "en" || Boolean(deal.descriptionEn?.trim()),
    image: images[0],
    images,
    price: deal.price,
    wasPrice,
    saving,
    savingPercent: wasPrice > 0 ? Math.round((saving / wasPrice) * 100) : 0,
    slots,
    minItems: Math.max(deal.minItems, 1),
    soldOut,
    allergens: [...allergens.values()],
    mayContain: [...mayContain.values()],
  };
}

/** Live deals: featured first, then in the owner's order. */
export async function getPublicDeals(locale = "nl"): Promise<PublicDeal[]> {
  const { data, stock } = await readWithStock();
  return (data.deals ?? [])
    .filter((d) => d.visible && isSellablePrice(d.price))
    .sort((a, b) => Number(Boolean(b.featured)) - Number(Boolean(a.featured)))
    .map((d) => toPublicDeal(d, data, stock, locale));
}

export async function getPublicDeal(slug: string, locale = "nl"): Promise<PublicDeal | null> {
  return (await getPublicDeals(locale)).find((d) => d.slug === slug) ?? null;
}
