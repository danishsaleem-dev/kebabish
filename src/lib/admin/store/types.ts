import type { Allergen, IngredientGroup } from "@/lib/admin/ingredients";
import type { Unit } from "@/lib/admin/units";

/**
 * The admin panel's mutable domain model.
 *
 * These types are deliberately backend-agnostic — they describe what the app
 * needs, not how it's stored. The JSON-file store implements them today and a
 * Supabase adapter will implement the same shapes later, so nothing above the
 * store layer has to change when the backend swaps.
 */

export interface StoredMedia {
  id: string;
  /** Public URL, e.g. /uploads/chicken-biryani-a1b2.jpg */
  url: string;
  filename: string;
  /** Alt text — required for accessibility and worth real SEO on a food site. */
  alt: string;
  mimeType: string;
  sizeBytes: number;
  width: number;
  height: number;
  uploadedAt: string;
}

export interface StoredCategory {
  id: string;
  label: string;
  /** English name, if different from `label`. Empty/absent = same as `label`. */
  labelEn?: string;
  description: string;
  /** Display order on the public menu; 1-based. */
  position: number;
  visible: boolean;
  /** Media id for the category's featured image. */
  imageId?: string;
}

export interface StoredItem {
  slug: string;
  /**
   * The name in the site's default language (Dutch). It is also what every
   * order snapshots and what the kitchen reads, so it stays one language.
   */
  name: string;
  /** English name for /en pages. Empty/absent = show `name` there too. */
  nameEn?: string;
  /**
   * Portion or quantity as the customer should see it — "500 g", "4 stuks".
   * Free text, shown beside the price. Empty/absent = not shown.
   */
  portion?: string;
  /** One of at most FEATURED_LIMIT dishes shown on the homepage. */
  featured?: boolean;
  categoryId: string;
  price: number | null;
  variants: string[];
  vegetarian: boolean;
  /**
   * Kept in step with `spiceLevel` (true when it is 1–3), so the menu's "spicy" filter and
   * anything else that only needs yes/no keeps working. Older dishes were saved with this
   * alone and no level: they show as "spicy" without a level until one is picked.
   */
  spicy: boolean;
  /** 0 = not spicy, 1 = mild, 2 = medium, 3 = hot. Absent on older data (see `spicy`). */
  spiceLevel?: SpiceLevel;
  /** The owner's "Chef's pick" badge. ("Bestseller" is never set by hand — it is counted from orders.) */
  chefsPick?: boolean;
  soldOut: boolean;
  /**
   * Shown on the public menu at all. Separate from `soldOut` — a sold-out
   * dish still shows (marked unavailable); an invisible one is a draft
   * that doesn't appear yet, e.g. while you're still setting it up.
   */
  visible: boolean;
  /**
   * Plain-text description for the dish's page (and its search snippet), in
   * the default language; line breaks are kept. Empty string means none.
   */
  description: string;
  /** English description for /en pages. Empty/absent = show `description`. */
  descriptionEn?: string;
  /**
   * Public URL of an uploaded video in the `videos` storage bucket, or ""
   * for none. Kept off the image media library on purpose: that bucket is
   * images-only and 6 MB-capped, and videos upload browser -> Supabase
   * directly (Vercel caps request bodies at ~4.5 MB).
   */
  videoUrl: string;
  /** Media ids, in display order. The first is the featured image. */
  imageIds: string[];
  /** Extras offered with this dish, by option-group id. */
  optionGroupIds: string[];
  /** Free-form labels, admin-side only for now — not yet a public filter. */
  tags: string[];
  /**
   * Manually flagged allergens, by allergen id. Separate from a recipe's
   * own auto-rolled-up allergens (from its ingredients) — a dish can be
   * flagged here before its recipe exists, or for an allergen that isn't
   * traceable to one ingredient line.
   */
  allergenIds: string[];
  /**
   * Dishes the owner says go well with this one (by slug, at most PAIRS_LIMIT). They
   * lead the "Often bought with" suggestions beside this dish and anything that has it
   * in the basket; the rest of the strip is filled from real orders and popularity.
   * Optional and absent on older data.
   */
  pairsWith?: string[];
}

export type SpiceLevel = 0 | 1 | 2 | 3;

/** How many "often bought with" dishes can be picked for one dish. */
export const PAIRS_LIMIT = 4;

/** One choice inside an option group, e.g. "Garlic sauce" at +€0.75. */
export interface StoredOption {
  id: string;
  label: string;
  labelEn?: string;
  /** Surcharge in euros. 0 is free. */
  price: number;
}

/**
 * A reusable set of extras ("Sauces", "Drinks", "Extra toppings") that can
 * be attached to any number of dishes. Reusable rather than per-dish so
 * changing the price of a sauce is one edit, not twenty.
 */
export interface StoredOptionGroup {
  id: string;
  label: string;
  labelEn?: string;
  /** 0 makes the group optional; 1+ forces a choice. */
  minChoices: number;
  /** 1 renders as radios, more as checkboxes capped at this many. */
  maxChoices: number;
  options: StoredOption[];
}

export interface StoredSettings {
  /** Opening hours per weekday, 0 = Sunday. Closed when `closed` is true. */
  hours: {
    day: number;
    closed: boolean;
    opens: string;
    closes: string;
    /** Length of a delivery slot on this weekday. Absent = the default below. */
    slotMinutes?: number;
    /** How many orders one slot takes on this weekday. Absent = the default below. */
    slotCapacity?: number;
  }[];
  /** Default delivery-slot length in minutes (30-120). Absent = 45. */
  slotMinutes?: number;
  /** Default orders per slot. Absent = 10. A specific slot's own limit still wins. */
  slotCapacity?: number;
  /** How many days ahead a customer can book, counting today. Absent = 7. */
  bookingWindowDays?: number;
  deliveryRadiusKm: number;
  deliveryFee: number;
  freeDeliveryOver: number | null;
  minimumOrder: number;
  averagePrepMinutes: number;
  acceptingOrders: boolean;
  orderNotice: string;
  /**
   * VAT included in every consumer price, as a percentage (e.g. 9). Null
   * until the accountant has confirmed it — nothing on invoices or the
   * receipt shows a VAT amount until it is set, rather than guessing.
   * Optional because settings saved before this existed don't carry it.
   */
  vatRatePercent?: number | null;
  /** Dutch BTW-id of the business, e.g. NL123456789B01. Shown on invoices and in the footer once set. */
  vatNumber?: string;
  /**
   * Print the registered company name (Marfah Enterprise) next to "Kebabish"
   * on invoices. Off by default — the public site only names it on Privacy and
   * Terms — but a Dutch invoice may need the supplier's legal name, so this is
   * a switch for the owner/accountant rather than a decision made in code.
   */
  showLegalNameOnInvoice?: boolean;
  /**
   * The "Nieuw in Hoogkarspel" badge above the homepage headline. A launch
   * message, so the owner switches it off once it stops being true. Absent
   * (settings saved before this existed) counts as on.
   */
  showLaunchBadge?: boolean;
  /**
   * A shared Mollie Payment Link (https://payment-links.mollie.com/...). When
   * set, checkout skips the Mollie API and sends the customer to this link,
   * with staff confirming each payment by hand — see src/lib/payment-link.ts.
   * Empty = the normal automatic Mollie checkout.
   */
  paymentLinkUrl?: string;
  /**
   * Media ids for the homepage photo showcase, in display order. Empty (or
   * absent) hides the section entirely rather than showing placeholders —
   * see src/components/home/Showcase.tsx.
   */
  galleryMediaIds?: string[];
  /**
   * The Google review link shown to a happy customer once they have sent
   * feedback. Empty until the owner pastes it (we have no Business Profile URL
   * to assume). Google-hosted addresses only — see feedback/review-url.ts.
   */
  googleReviewUrl?: string;
  /**
   * When the owner last downloaded a backup (Settings -> Backup), and how many
   * rows it held. Written by the download itself, never by the settings form —
   * so saving settings can't wipe it. Drives the "backup overdue" reminder.
   */
  lastBackupAt?: string;
  lastBackupRows?: number;
}

export interface StoredIngredient {
  id: string;
  name: string;
  group: IngredientGroup;
  unit: Unit;
  costPerUnit: number;
  allergens: Allergen[];
  supplier?: string;
}

export interface StoredRecipeLine {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  note?: string;
  optional?: boolean;
}

export interface StoredRecipe {
  menuItemSlug: string;
  portionWeightG: number;
  batchPortions: number;
  prepMinutes: number;
  cookMinutes: number;
  lines: StoredRecipeLine[];
  steps: string[];
  notes?: string;
}

export interface StoredAllergen {
  id: string;
  label: string;
  /** True for the 14 EU-mandated allergens — these can be renamed but not deleted. */
  statutory: boolean;
}

export interface StoredPromoCode {
  id: string;
  /** Stored uppercase; matching is case-insensitive at lookup time. */
  code: string;
  type: "percentage" | "fixed";
  /** A percentage (1-100) when `type` is "percentage", euros when "fixed". */
  value: number;
  active: boolean;
  /** Euros; null means no minimum order. */
  minOrder: number | null;
  /** ISO date (yyyy-mm-dd); null means it never expires. */
  expiresAt: string | null;
  /** Once true, a customer email can redeem this code on at most one paid order. */
  singleUsePerCustomer: boolean;
  /** ISO date (yyyy-mm-dd); the code doesn't work before it. Absent/null = from now. */
  startsAt?: string | null;
  /**
   * The most orders that may use this code in total, across everyone.
   * Absent/null = unlimited. Counted from paid orders plus checkouts still
   * waiting to be paid, so a code can't be oversold by people mid-payment.
   */
  maxRedemptions?: number | null;
  /** Only for a customer who has never completed a paid order. */
  firstOrderOnly?: boolean;
  /**
   * Limit the discount to these dishes and categories. A line qualifies if it
   * matches either list; both empty/absent = the whole order qualifies.
   * The discount is then worked out on the qualifying lines only.
   */
  onlyCategoryIds?: string[];
  onlyItemSlugs?: string[];
  /**
   * An optional promotional image (a media-library id). While the code is valid,
   * a code that has one is shown as a popup to visitors of the website; clicking
   * the image adds the code to their basket. No image = no popup, so a code can
   * be kept private (e.g. handed to one customer). Setting one makes the code
   * public: it ends up in the page the popup is rendered into.
   */
  imageId?: string;
  createdAt: string;
}

export interface StoreShape {
  categories: StoredCategory[];
  items: StoredItem[];
  optionGroups: StoredOptionGroup[];
  ingredients: StoredIngredient[];
  recipes: StoredRecipe[];
  allergens: StoredAllergen[];
  promoCodes: StoredPromoCode[];
  media: StoredMedia[];
  settings: StoredSettings;
}

/** Every backend adapter satisfies this. */
export interface StoreAdapter {
  read(): Promise<StoreShape>;
  write(data: StoreShape): Promise<void>;
}
