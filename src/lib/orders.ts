import "server-only";
import { after } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/server";
import { readStore } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";
import { isSellablePrice, toCents } from "@/lib/money";
import type { MolliePaymentStatus } from "@/lib/mollie";
import { cancelPayment, getPayment, toPaymentStatus } from "@/lib/mollie";
import type { StoredPromoCode, StoreShape } from "@/lib/admin/store/types";
import { dishImage } from "@/lib/dish-images";
import { sendNewOrderEmail, sendUnacceptedOrderEmail } from "@/lib/email/new-order";
import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import { releaseDeliverySlot, reserveDeliverySlot } from "@/lib/delivery-slots-data";
import { PAYMENT_LINK_HOLD_MINUTES } from "@/lib/payment-link";
import { amsterdamNow, weekdayForDateKey } from "@/lib/delivery-slots";
import { isFutureDelivery } from "@/lib/admin/order-types";
import { fetchLineExtras } from "@/lib/order-extras";

/**
 * Orders: pricing, persistence, and payment reconciliation.
 *
 * The cart lives in the customer's browser, so nothing it says about money
 * is trusted here. `priceCart` throws away the submitted prices entirely
 * and rebuilds every line from the store — a tampered localStorage can
 * change what someone *orders*, never what they *pay*.
 */

export interface SubmittedOption {
  groupId: string;
  optionId: string;
}

export interface SubmittedLine {
  slug: string;
  quantity: number;
  options: SubmittedOption[];
  instructions: string;
}

export interface PricedOption {
  groupLabel: string;
  optionLabel: string;
  priceCents: number;
}

export interface PricedLine {
  slug: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  options: PricedOption[];
  instructions: string;
  lineTotalCents: number;
}

export interface PricedCart {
  lines: PricedLine[];
  subtotalCents: number;
}

export class CartPricingError extends Error {}

/** Rebuild the cart from the store. Never trusts submitted prices. */
export async function priceCart(
  submitted: SubmittedLine[]
): Promise<PricedCart> {
  if (submitted.length === 0) throw new CartPricingError("empty");

  const store = await readStore();
  const lines: PricedLine[] = [];

  for (const line of submitted) {
    const item = store.items.find((i) => i.slug === line.slug);
    if (!item) throw new CartPricingError("missing");
    // A draft or hidden dish, or one in a hidden category, isn't on the menu
    // — a cart that still holds one is stale (or hand-edited).
    if (!item.visible) throw new CartPricingError("missing");
    const category = store.categories.find((c) => c.id === item.categoryId);
    if (!category?.visible) throw new CartPricingError("missing");
    if (item.soldOut) throw new CartPricingError("soldOut");
    // A dish with no price can't be checked out — the UI never offers it,
    // so reaching here means the cart is stale or hand-edited.
    // The floor also keeps a €0.01 placeholder from being bought.
    if (!isSellablePrice(item.price)) throw new CartPricingError("unpriced");

    const quantity = Math.min(Math.max(Math.trunc(line.quantity), 1), 50);
    const options: PricedOption[] = [];

    for (const chosen of line.options) {
      // The group must actually be offered on this dish, not merely exist.
      if (!item.optionGroupIds?.includes(chosen.groupId)) {
        throw new CartPricingError("badOption");
      }
      const group = store.optionGroups?.find((g) => g.id === chosen.groupId);
      const option = group?.options.find((o) => o.id === chosen.optionId);
      if (!group || !option) throw new CartPricingError("badOption");

      options.push({
        groupLabel: group.label,
        optionLabel: option.label,
        priceCents: toCents(option.price),
      });
    }

    // Required choices are enforced here too, not only in the browser.
    for (const groupId of item.optionGroupIds ?? []) {
      const group = store.optionGroups?.find((g) => g.id === groupId);
      if (!group || group.minChoices === 0) continue;
      const picked = line.options.filter((o) => o.groupId === groupId).length;
      if (picked < group.minChoices) throw new CartPricingError("missingChoice");
    }

    const unitPriceCents = toCents(item.price);
    const extrasCents = options.reduce((sum, o) => sum + o.priceCents, 0);

    lines.push({
      slug: item.slug,
      name: item.name,
      unitPriceCents,
      quantity,
      options,
      instructions: line.instructions.slice(0, 300),
      lineTotalCents: (unitPriceCents + extrasCents) * quantity,
    });
  }

  return {
    lines,
    subtotalCents: lines.reduce((sum, l) => sum + l.lineTotalCents, 0),
  };
}

/** The dish's photo, by the same rule the public menu uses. */
function itemImage(item: StoreShape["items"][number], store: StoreShape): string | undefined {
  const uploaded = item.imageIds?.length
    ? (store.media ?? []).find((m) => m.id === item.imageIds[0])?.url
    : undefined;
  return uploaded ?? dishImage(item.slug);
}

/** What the cart page needs to know about one line, without throwing. */
export type CartLineStatus =
  | {
      status: "ok";
      unitPrice: number;
      optionPrices: Record<string, number>;
      /** Current photo, so the cart can show (and backfill) it. */
      image?: string;
    }
  | { status: "soldOut" | "unavailable" | "optionsChanged" };

/**
 * Check each cart line against the live menu — the friendly counterpart to
 * `priceCart`, which throws on the first problem. The cart and checkout pages
 * use this to tell the customer *which* dish is the trouble (sold out since
 * they added it, taken off the menu, its extras changed) so they can remove
 * just that one and keep the rest, instead of meeting a generic error when
 * they press pay. Never trusted for money: `priceCart` still re-checks all of
 * it at the moment of payment. For lines that are fine it also returns the
 * *current* prices so the cart can quietly catch up with a price change.
 */
export async function inspectCart(
  submitted: { slug: string; options: SubmittedOption[] }[]
): Promise<CartLineStatus[]> {
  const store = await readStore();

  return submitted.map((line) => {
    const item = store.items.find((i) => i.slug === line.slug);
    const category = item && store.categories.find((c) => c.id === item.categoryId);
    if (!item || !item.visible || !category?.visible || !isSellablePrice(item.price)) {
      return { status: "unavailable" as const };
    }
    if (item.soldOut) return { status: "soldOut" as const };

    const optionPrices: Record<string, number> = {};
    for (const chosen of line.options) {
      const group = store.optionGroups?.find((g) => g.id === chosen.groupId);
      const option = group?.options.find((o) => o.id === chosen.optionId);
      if (!item.optionGroupIds?.includes(chosen.groupId) || !group || !option) {
        return { status: "optionsChanged" as const };
      }
      optionPrices[`${chosen.groupId}:${chosen.optionId}`] = option.price;
    }
    for (const groupId of item.optionGroupIds ?? []) {
      const group = store.optionGroups?.find((g) => g.id === groupId);
      if (!group || group.minChoices === 0) continue;
      if (line.options.filter((o) => o.groupId === groupId).length < group.minChoices) {
        return { status: "optionsChanged" as const };
      }
    }

    return {
      status: "ok" as const,
      unitPrice: item.price,
      optionPrices,
      image: itemImage(item, store),
    };
  });
}

/** Delivery fee for a subtotal, from the owner's current settings. */
export async function deliveryFeeCents(subtotalCents: number): Promise<number> {
  const { settings } = await readStore();
  if (
    settings.freeDeliveryOver != null &&
    subtotalCents >= toCents(settings.freeDeliveryOver)
  ) {
    return 0;
  }
  return toCents(settings.deliveryFee);
}

/** Case- and punctuation-insensitive match against the delivery area. */
export function isDeliverableTown(town: string): boolean {
  const normalise = (v: string) =>
    v.toLowerCase().replace(/[^a-z]/g, "");
  const target = normalise(town);
  return siteConfig.deliveryAreaTowns.some((t) => normalise(t.name) === target);
}

export type PromoError =
  | "notFound"
  | "expired"
  | "notStarted"
  | "belowMinimum"
  | "alreadyUsed"
  | "usedUp"
  | "notFirstOrder"
  | "notApplicable";

export type PromoValidation =
  | { ok: true; code: string; discountCents: number }
  | { ok: false; error: PromoError };

/** The slice of a priced cart a promo code needs to look at. */
export interface PromoCart {
  subtotalCents: number;
  lines: { slug: string; lineTotalCents: number }[];
}

/**
 * Validate a promo code against the server-priced cart.
 *
 * Called twice: once from the checkout page (no `customerEmail` yet, so the
 * per-customer checks are skipped) as a live preview while typing, and again
 * inside `checkoutAction` with the real email, which is the only check that
 * actually gates payment — never trust the client's own "applied" state for
 * money, same as `priceCart`.
 *
 * The discount is worked out on the *qualifying* lines when the code is
 * restricted to certain dishes or categories, so "20% off kebabs" never
 * discounts the drinks in the same basket.
 */
export async function validatePromoCode(
  rawCode: string,
  cart: PromoCart,
  customerEmail?: string,
  /** Check the code as of this Amsterdam day instead of today (an order entered after the fact). */
  asOfDate?: string
): Promise<PromoValidation> {
  const store = await readStore();
  const code = rawCode.trim().toUpperCase();
  const promo = (store.promoCodes ?? []).find((p) => p.code === code);

  if (!promo || !promo.active) return { ok: false, error: "notFound" };

  // Amsterdam's calendar day, like everything else the kitchen runs on — not
  // UTC's, which would flip a code an hour (or two) early or late.
  const today = asOfDate ?? amsterdamNow().dateKey;
  if (promo.startsAt && promo.startsAt > today) return { ok: false, error: "notStarted" };
  if (promo.expiresAt && promo.expiresAt < today) return { ok: false, error: "expired" };

  if (promo.minOrder != null && cart.subtotalCents < toCents(promo.minOrder)) {
    return { ok: false, error: "belowMinimum" };
  }

  // Which lines the discount applies to.
  const onlyItems = new Set(promo.onlyItemSlugs ?? []);
  const onlyCategories = new Set(promo.onlyCategoryIds ?? []);
  const restricted = onlyItems.size > 0 || onlyCategories.size > 0;
  let eligibleCents = cart.subtotalCents;
  if (restricted) {
    const categoryOf = new Map(store.items.map((i) => [i.slug, i.categoryId]));
    eligibleCents = cart.lines
      .filter(
        (l) =>
          onlyItems.has(l.slug) || onlyCategories.has(categoryOf.get(l.slug) ?? "")
      )
      .reduce((sum, l) => sum + l.lineTotalCents, 0);
    if (eligibleCents === 0) return { ok: false, error: "notApplicable" };
  }

  if (promo.maxRedemptions != null) {
    const used = (await promoRedemptionCounts()).get(promo.code) ?? 0;
    if (used >= promo.maxRedemptions) return { ok: false, error: "usedUp" };
  }

  if (customerEmail) {
    if (promo.singleUsePerCustomer && (await promoAlreadyUsedBy(promo.code, customerEmail))) {
      return { ok: false, error: "alreadyUsed" };
    }
    if (promo.firstOrderOnly && (await hasPaidOrder(customerEmail))) {
      return { ok: false, error: "notFirstOrder" };
    }
  }

  return { ok: true, code: promo.code, discountCents: discountFor(promo, eligibleCents) };
}

function discountFor(promo: StoredPromoCode, eligibleCents: number): number {
  const raw =
    promo.type === "percentage"
      ? Math.round((eligibleCents * promo.value) / 100)
      : toCents(promo.value);
  return Math.min(Math.max(raw, 0), eligibleCents);
}

/**
 * How many orders are using each code right now: paid ones, plus checkouts
 * still waiting to be paid (so the last redemption can't be handed to two
 * people mid-payment). An abandoned checkout stops counting as soon as it
 * expires. Not a `head: true` count — see `promoAlreadyUsedBy`.
 */
export async function promoRedemptionCounts(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("promo_code")
    .not("promo_code", "is", null)
    .in("payment_status", ["paid", "open"]);
  if (error) throw new Error(error.message);

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const code = row.promo_code as string;
    counts.set(code, (counts.get(code) ?? 0) + 1);
  }
  return counts;
}

/** Has this email ever completed a paid order? (For "first order only" codes.) */
async function hasPaidOrder(customerEmail: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("id")
    .ilike("customer_email", customerEmail)
    .eq("payment_status", "paid")
    .limit(1);
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/**
 * Has this email already completed a paid order redeeming this code?
 *
 * Deliberately not a `head: true` count query — against a missing column or
 * table that gotcha silently returns a false "0" instead of a real error
 * (see `countAdminUsers`). A normal select surfaces failures honestly.
 */
async function promoAlreadyUsedBy(
  code: string,
  customerEmail: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("id")
    .eq("promo_code", code)
    .ilike("customer_email", customerEmail)
    .eq("payment_status", "paid")
    .limit(1);

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** The old random format, still used until migration 0016 has been run. */
function legacyReference(): string {
  return `#KB-${Math.floor(100000 + Math.random() * 900000)}`;
}

/**
 * KBB-2026-000123 — the next number from a per-year counter in the database
 * (`next_order_reference()`, migration 0016). Falls back to the random legacy
 * format if the function isn't there yet, so deploying before the migration
 * doesn't stop anyone ordering. A real database error is not hidden: it
 * throws, like any other failure to write an order.
 */
async function newReference(): Promise<string> {
  const { data, error } = await supabaseAdmin().rpc("next_order_reference");
  if (!error && typeof data === "string") return data;
  if (error && error.code !== "PGRST202") throw new Error(error.message);
  return legacyReference();
}

export interface CreateOrderInput {
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressStreet: string;
  addressPostcode: string;
  addressCity: string;
  notes: string | null;
  cart: PricedCart;
  deliveryFeeCents: number;
  promoCode: string | null;
  discountCents: number;
  /** Null for a manual order booked without a delivery slot. */
  deliveryDate: string | null;
  deliverySlotStart: string | null;
  deliverySlotEnd: string | null;
  /** The site language the customer ordered in. */
  locale: string;
  /** Ticked "email me offers" at checkout — false unless they did. */
  marketingOptIn: boolean;
  /**
   * Set only for orders staff enter by hand. A website checkout leaves it out
   * and gets the defaults: website, paid through Mollie, awaiting payment,
   * waiting for the kitchen to accept.
   */
  /** Set when paying through the shared Mollie payment link (see payment-link.ts). */
  paymentMethod?: "payment_link";
  manual?: {
    channel: "website" | "whatsapp" | "phone" | "other";
    channelNote: string | null;
    paymentMethod: "mollie" | "cash" | "bank_transfer" | "unpaid";
    /** Already settled (cash handed over, transfer received) — or still owed. */
    paid: boolean;
    /** Staff took the order themselves, so it starts accepted unless it's awaiting an online payment. */
    accepted: boolean;
    createdBy: string;
    /**
     * An order that already happened, entered afterwards: when it was placed (the moment
     * reports and the order list file it under), and whether it is already delivered.
     */
    placedAt?: string;
    delivered?: boolean;
  };
}

export async function createOrder(input: CreateOrderInput) {
  const supabase = supabaseAdmin();
  const totalCents = Math.max(
    input.cart.subtotalCents - input.discountCents + input.deliveryFeeCents,
    0
  );

  // Until migration 0020 is run the database has no "scheduled" status; a manual order
  // for a later day then falls back to "preparing" rather than failing to save.
  let noScheduledStatus = false;

  // The reference is unique in the database; on the rare collision, try a
  // new one rather than failing someone's checkout.
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = await newReference();

    const { data, error } = await supabase
      .from("orders")
      .insert({
        reference,
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        fulfilment: "delivery",
        locale: input.locale === "en" ? "en" : "nl",
        marketing_opt_in: input.marketingOptIn,
        address_street: input.addressStreet,
        address_postcode: input.addressPostcode,
        address_city: input.addressCity,
        notes: input.notes,
        subtotal_cents: input.cart.subtotalCents,
        delivery_fee_cents: input.deliveryFeeCents,
        promo_code: input.promoCode,
        discount_cents: input.discountCents,
        total_cents: totalCents,
        delivery_date: input.deliveryDate,
        delivery_slot_start: input.deliverySlotStart,
        delivery_slot_end: input.deliverySlotEnd,
        ...(input.paymentMethod ? { payment_method: input.paymentMethod } : {}),
        ...(input.manual
          ? (() => {
              const m = input.manual;
              const at = m.placedAt ?? new Date().toISOString();
              return {
                channel: m.channel,
                channel_note: m.channelNote,
                payment_method: m.paymentMethod,
                payment_status: m.paid ? "paid" : "open",
                paid_at: m.paid ? at : null,
                status: m.delivered
                  ? "delivered"
                  : m.accepted
                    ? isFutureDelivery(input.deliveryDate) && !noScheduledStatus
                      ? "scheduled"
                      : "preparing"
                    : "new",
                accepted_at: m.accepted || m.delivered ? at : null,
                delivered_at: m.delivered ? at : null,
                created_by: m.createdBy,
                ...(m.placedAt ? { created_at: m.placedAt } : {}),
              };
            })()
          : {}),
      })
      .select("id, reference")
      .single();

    if (error) {
      if (error.code === "23505") continue; // duplicate reference
      if (error.code === "23514" && input.manual && !noScheduledStatus) {
        console.error("[orders] status 'scheduled' refused by the database - run migration 0020. Saving as 'preparing'.");
        noScheduledStatus = true;
        continue;
      }
      throw new Error(error.message);
    }

    const { error: itemsError } = await supabase.from("order_items").insert(
      input.cart.lines.map((line) => ({
        order_id: data.id,
        item_slug: line.slug,
        name: line.name,
        unit_price_cents: line.unitPriceCents,
        quantity: line.quantity,
        options: line.options,
        instructions: line.instructions || null,
        line_total_cents: line.lineTotalCents,
      }))
    );

    if (itemsError) {
      // An order with no lines is worse than no order — the kitchen would
      // see a paid total and nothing to cook.
      await supabase.from("orders").delete().eq("id", data.id);
      throw new Error(itemsError.message);
    }

    return { id: data.id as string, reference: data.reference as string, totalCents };
  }

  throw new Error("Could not allocate an order reference.");
}

export async function attachPayment(orderId: string, molliePaymentId: string) {
  const { error } = await supabaseAdmin()
    .from("orders")
    .update({ mollie_payment_id: molliePaymentId, updated_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) throw new Error(error.message);
}

/**
 * Apply a Mollie status to the order it belongs to. Called by both the
 * webhook and the return page, so a customer who lands back before the
 * webhook fires still sees the right thing — which is also why the
 * new-order email only fires here, guarded by `wasAlreadyPaid`: whichever
 * of the two calls this first is the one that sends it, and the other
 * (arriving moments later, same transition) doesn't send a second copy.
 */
export async function syncPaymentStatus(
  molliePaymentId: string,
  status: MolliePaymentStatus,
  /** The customer's site language, for the confirmation email. */
  locale?: string
) {
  const mapped = toPaymentStatus(status);
  const TERMINAL_FAILURE = new Set(["failed", "expired", "canceled"]);

  const { data: before, error: fetchError } = await supabaseAdmin()
    .from("orders")
    .select("payment_status, delivery_date, delivery_slot_start")
    .eq("mollie_payment_id", molliePaymentId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  const wasAlreadyPaid = before?.payment_status === "paid";
  const wasAlreadyTerminal = TERMINAL_FAILURE.has(before?.payment_status ?? "");

  // A refunded order stays refunded: Mollie keeps reporting the underlying
  // payment as "paid" (it was), and a later webhook must not flip it back.
  if (before?.payment_status === "refunded") return "refunded" as const;

  // Nothing changed — the return page polls this every few seconds, and a
  // write here would keep refreshing `updated_at`, which the stale-order
  // sweep reads as "a payment attempt just happened" and never expires.
  if (before && before.payment_status === mapped) return mapped;

  const { error } = await supabaseAdmin()
    .from("orders")
    .update({
      payment_status: mapped,
      paid_at: mapped === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("mollie_payment_id", molliePaymentId);

  if (error) throw new Error(error.message);

  if (mapped === "paid" && !wasAlreadyPaid) {
    const order = await getOrderByMolliePaymentId(molliePaymentId);
    // A failure to notify shouldn't fail the payment reconciliation itself
    // — the order is correctly paid either way, this is just the heads-up.
    // after(), not a bare `void promise`: on Vercel the function can be
    // frozen the instant the response goes out, silently dropping an
    // email that's still mid-flight. after() keeps it alive to completion
    // without holding up the response.
    if (order) {
      after(() => sendNewOrderEmail(order));
      after(() => sendOrderConfirmationEmail(order, locale));
    }
  }

  // A payment that's never going to complete shouldn't go on holding a
  // kitchen slot hostage — release it back into the pool. Guarded the same
  // way as the email above: only on the first transition into a failure
  // state, so a retried webhook doesn't release the same seat twice.
  if (TERMINAL_FAILURE.has(mapped) && !wasAlreadyTerminal && before) {
    await releaseDeliverySlot(before.delivery_date, before.delivery_slot_start);
  }

  return mapped;
}

/* --------------------------------------------------- stale unpaid checkouts */

/**
 * How long a checkout may sit unpaid before its delivery slot goes back in
 * the pool. Measured from the last payment attempt (`updated_at`, which a
 * retry refreshes), not from when the order row was first written.
 */
export const PAYMENT_HOLD_MINUTES = 15;

let lastSweepAt = 0;

/**
 * Give back the slots held by checkouts that were started and abandoned.
 *
 * Nothing used to expire them: a slot was released only if Mollie later
 * said failed/expired/canceled, so a customer who simply closed the tab
 * could hold a seat for as long as Mollie took to notice. There is no
 * scheduled job on this project, so this runs lazily — from the routes
 * that are hit exactly when it matters (slot lookups, checkout, the admin
 * order poll) — and at most once a minute per server instance.
 *
 * A payment is only ever given up on after Mollie has been asked what it
 * is doing now: it might be paid with the webhook still on its way. One
 * that is still open is *cancelled at Mollie* before its slot is released,
 * so the customer can't pay for a seat we've already resold. A payment
 * that can't be cancelled is left alone until Mollie expires it itself —
 * which is the normal case: iDEAL, the main method, is not cancellable but
 * Mollie expires it 15 minutes after creation, so in practice the hold ends
 * when Mollie says so and this sweep just notices (checked against the real
 * API: `isCancelable: false`, `expiresAt` = created + 15 min).
 */
export async function expireStaleOrders(): Promise<void> {
  if (Date.now() - lastSweepAt < 60_000) return;
  lastSweepAt = Date.now();

  try {
    const cutoff = new Date(Date.now() - PAYMENT_HOLD_MINUTES * 60_000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("orders")
      .select("id, mollie_payment_id")
      .eq("payment_status", "open")
      // Cash / bank-transfer / pay-later orders have no payment provider to
      // expire them — a person marks those paid. Only an online checkout can
      // be "abandoned".
      .eq("payment_method", "mollie")
      .lt("updated_at", cutoff)
      .order("updated_at", { ascending: true })
      .limit(20);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      try {
        if (!row.mollie_payment_id) {
          // The payment was never created; checkoutAction already handed the
          // slot back when that failed, so only close the row — releasing
          // here too would give the seat back twice.
          await supabaseAdmin()
            .from("orders")
            .update({ payment_status: "failed", updated_at: new Date().toISOString() })
            .eq("id", row.id)
            .eq("payment_status", "open");
          continue;
        }

        const payment = await getPayment(row.mollie_payment_id);
        if (payment.status === "open") {
          if (!payment.isCancelable) continue;
          if (!(await cancelPayment(payment.id))) continue;
          await syncPaymentStatus(payment.id, "canceled");
        } else {
          // paid / failed / expired / canceled — record what really happened.
          await syncPaymentStatus(payment.id, payment.status);
        }
      } catch (error) {
        console.error("[orders] could not expire order", row.id, error);
      }
    }
  } catch (error) {
    console.error("[orders] stale-order sweep failed:", error);
  }

  await expireStalePaymentLinkOrders();
}

/**
 * Orders waiting on the shared payment link have no provider to ask, so they
 * lapse on a plain timer — long enough (PAYMENT_LINK_HOLD_MINUTES) for staff to
 * spot the payment in Mollie. A lapsed order only gives its slot back and shows
 * as expired; it is never cancelled, and "Mark as paid" still works on it, so a
 * customer who paid late is not lost (see markOrderPaid).
 */
async function expireStalePaymentLinkOrders(): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - PAYMENT_LINK_HOLD_MINUTES * 60_000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("orders")
      .select("id, delivery_date, delivery_slot_start")
      .eq("payment_status", "open")
      .eq("payment_method", "payment_link")
      .lt("updated_at", cutoff)
      .limit(20);
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      // The conditional update is the claim: only the call that flips it
      // releases the slot, so overlapping sweeps can't give a seat back twice.
      const { data: flipped } = await supabaseAdmin()
        .from("orders")
        .update({ payment_status: "expired", updated_at: new Date().toISOString() })
        .eq("id", row.id)
        .eq("payment_status", "open")
        .select("id");
      if (flipped && flipped.length > 0) {
        await releaseDeliverySlot(row.delivery_date, row.delivery_slot_start);
      }
    }
  } catch (error) {
    console.error("[orders] payment-link sweep failed:", error);
  }
}

/* -------------------------------------------------- manual-order payments */

/**
 * Mark a hand-entered order as paid — the cash was handed over at the door,
 * or the transfer arrived. Only for orders with no payment provider; an
 * online (Mollie) order is marked paid by Mollie telling us so, never by a
 * person. The conditional update is the lock: marking twice does nothing.
 * Sends the customer their confirmation (with the invoice number) if the
 * order has an email address.
 */
export async function markOrderPaid(orderId: string): Promise<boolean> {
  // A payment-link order that lapsed before staff confirmed it can still be
  // marked paid — the customer did pay — and it then takes its slot back.
  const { data: before } = await supabaseAdmin()
    .from("orders")
    .select("payment_status, payment_method, delivery_date, delivery_slot_start")
    .eq("id", orderId)
    .maybeSingle();
  const lapsed = before?.payment_method === "payment_link" && before.payment_status === "expired";

  const { data, error } = await supabaseAdmin()
    .from("orders")
    .update({
      payment_status: "paid",
      paid_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .in("payment_status", ["open", "expired"])
    .neq("payment_method", "mollie")
    .select("id");
  if (error) throw new Error(error.message);
  if (!data || data.length === 0) return false;

  if (lapsed && before?.delivery_date && before.delivery_slot_start) {
    // Best effort: if the slot filled up meanwhile the order still stands — the
    // money is in — and staff deal with the overlap.
    try {
      await reserveDeliverySlot(
        before.delivery_date,
        weekdayForDateKey(before.delivery_date),
        before.delivery_slot_start
      );
    } catch (error) {
      console.error("[orders] could not re-reserve the slot for a late payment:", error);
    }
  }

  const order = await getOrderSummaryById(orderId);
  if (order) {
    // An order paid through the link reaches the kitchen only now, so this is
    // the moment it needs the same alert an online payment sends; hand-entered
    // (phone / cash) orders were already known to staff.
    if (order.paymentMethod === "payment_link") after(() => sendNewOrderEmail(order));
    if (order.customerEmail) after(() => sendOrderConfirmationEmail(order, order.locale));
  }
  return true;
}

/* ------------------------------------------------------- invoice numbers */

/**
 * The invoice number of a paid order (INV-2026-000123), assigning it if the
 * order doesn't have one yet. Returns null for an unpaid order — an unpaid
 * checkout never gets a number — and also if migration 0009 hasn't been run
 * yet, so the receipt, email and invoice simply omit the line rather than
 * failing while the database catches up.
 */
export async function getInvoiceNumber(reference: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin()
      .from("orders")
      .select("id, payment_status, invoice_number")
      .eq("reference", reference)
      .maybeSingle();
    if (error || !data) return null;
    if (data.invoice_number) return data.invoice_number as string;
    // Paid — or paid and since refunded: the invoice was due when it was paid.
    if (data.payment_status !== "paid" && data.payment_status !== "refunded") return null;

    const { data: assigned, error: rpcError } = await supabaseAdmin().rpc(
      "assign_invoice_number",
      { p_order: data.id }
    );
    if (rpcError) return null;
    return (assigned as string | null) ?? null;
  } catch (error) {
    console.error("[orders] could not read invoice number:", error);
    return null;
  }
}

/* ------------------------------------------------------ unaccepted orders */

/** After this long unaccepted, the kitchen screen turns urgent and an email goes out. */
export const ESCALATE_AFTER_MINUTES = 5;

let lastEscalationAt = 0;

/**
 * Email the kitchen once about a paid order nobody has accepted or declined.
 *
 * Claiming the row (setting `escalated_at` only where it is still null) is
 * what makes it once-only even if several requests run this at the same
 * moment. Like the stale-checkout sweep it is called from places that run
 * anyway (the admin poll) *and* from the housekeeping endpoint, which an
 * external once-a-minute caller can hit — the admin poll alone can't cover
 * the case that matters most, which is nobody having the admin open.
 */
export async function escalateUnacceptedOrders(): Promise<void> {
  if (Date.now() - lastEscalationAt < 30_000) return;
  lastEscalationAt = Date.now();

  try {
    const cutoff = new Date(Date.now() - ESCALATE_AFTER_MINUTES * 60_000).toISOString();
    const { data, error } = await supabaseAdmin()
      .from("orders")
      .update({ escalated_at: new Date().toISOString() })
      .eq("status", "new")
      .eq("payment_status", "paid")
      .is("escalated_at", null)
      .lt("paid_at", cutoff)
      .select("id, paid_at");
    if (error) throw new Error(error.message);

    for (const row of data ?? []) {
      const order = await getOrderSummaryById(row.id);
      if (!order) continue;
      const waited = Math.max(
        ESCALATE_AFTER_MINUTES,
        Math.round((Date.now() - Date.parse(row.paid_at)) / 60_000)
      );
      await sendUnacceptedOrderEmail(order, waited);
    }
  } catch (error) {
    console.error("[orders] escalation check failed:", error);
  }
}

/* -------------------------------------------------------- paying again */

export interface RetryableOrder {
  id: string;
  paymentStatus: string;
  totalCents: number;
  paymentMethod: string;
  reference: string;
  deliveryDate: string | null;
  deliverySlotStart: string | null;
  deliverySlotEnd: string | null;
}

export async function getOrderForRetry(reference: string): Promise<RetryableOrder | null> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("id, reference, payment_status, payment_method, total_cents, delivery_date, delivery_slot_start, delivery_slot_end")
    .eq("reference", reference)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    id: data.id,
    reference: data.reference,
    paymentStatus: data.payment_status,
    totalCents: data.total_cents,
    paymentMethod: data.payment_method ?? "mollie",
    deliveryDate: data.delivery_date,
    deliverySlotStart: data.delivery_slot_start,
    deliverySlotEnd: data.delivery_slot_end,
  };
}

/**
 * Atomically move a failed/expired/cancelled order back to "open" so that
 * exactly one request gets to start the new payment — a double-click would
 * otherwise reserve two seats and create two payments. The conditional
 * update is the lock. Also refreshes `updated_at`, which restarts the hold
 * clock the stale-order sweep above measures.
 */
export async function claimOrderForRetry(
  id: string,
  previousStatus: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .update({ payment_status: "open", paid_at: null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("payment_status", previousStatus)
    .select("id");
  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}

/** Undo `claimOrderForRetry` when the retry couldn't actually start. */
export async function restoreOrderPaymentStatus(id: string, status: string) {
  await supabaseAdmin()
    .from("orders")
    .update({ payment_status: status, updated_at: new Date().toISOString() })
    .eq("id", id);
}

/** Close an order whose payment could not even be started. */
export async function markOrderPaymentFailed(id: string) {
  await supabaseAdmin()
    .from("orders")
    .update({ payment_status: "failed", updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("payment_status", "open");
}

export interface ReceiptLine {
  id?: string;
  slug: string;
  name: string;
  quantity: number;
  unitPriceCents: number;
  options: PricedOption[];
  instructions: string | null;
  lineTotalCents: number;
  /** Set when staff swapped this in for something else on the order. */
  replaces?: string | null;
  /** The dish's regular price per portion, when the customer is charged less (a compensation). */
  listUnitPriceCents?: number | null;
}

export interface OrderSummary {
  id: string;
  /** The language they ordered in — what later emails are written in. */
  locale: string;
  /** Money already sent back to the customer, in cents. */
  refundedCents: number;
  reference: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  molliePaymentId: string | null;
  paymentMethod: string;
  fulfilment: "delivery" | "pickup";
  placedAt: string;
  customerId: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  addressStreet: string;
  addressPostcode: string;
  addressCity: string;
  notes: string | null;
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  deliveryFeeCents: number;
  deliveryDate: string | null;
  deliverySlotStart: string | null;
  deliverySlotEnd: string | null;
  lines: ReceiptLine[];
}

const ORDER_SELECT =
  "id, locale, refunded_cents, reference, status, payment_status, total_cents, mollie_payment_id, payment_method, fulfilment, " +
  "created_at, customer_id, customer_name, customer_email, customer_phone, " +
  "address_street, address_postcode, address_city, notes, subtotal_cents, " +
  "discount_cents, promo_code, delivery_fee_cents, " +
  "delivery_date, delivery_slot_start, delivery_slot_end, " +
  "order_items(id, item_slug, name, quantity, unit_price_cents, options, instructions, line_total_cents)";

interface OrderRow {
  id: string;
  locale: string | null;
  refunded_cents: number | null;
  reference: string;
  status: string;
  payment_status: string;
  total_cents: number;
  mollie_payment_id: string | null;
  payment_method: string | null;
  fulfilment: "delivery" | "pickup";
  created_at: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  address_street: string;
  address_postcode: string;
  address_city: string;
  notes: string | null;
  subtotal_cents: number;
  discount_cents: number | null;
  promo_code: string | null;
  delivery_fee_cents: number;
  delivery_date: string | null;
  delivery_slot_start: string | null;
  delivery_slot_end: string | null;
  order_items:
    | {
        id: string;
        item_slug: string;
        name: string;
        quantity: number;
        unit_price_cents: number;
        options: PricedOption[] | null;
        instructions: string | null;
        line_total_cents: number;
      }[]
    | null;
}

function mapOrderRow(row: OrderRow): OrderSummary {
  return {
    id: row.id,
    locale: row.locale ?? "nl",
    refundedCents: row.refunded_cents ?? 0,
    reference: row.reference,
    status: row.status,
    paymentStatus: row.payment_status,
    totalCents: row.total_cents,
    molliePaymentId: row.mollie_payment_id,
    paymentMethod: row.payment_method ?? "mollie",
    fulfilment: row.fulfilment,
    placedAt: row.created_at,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    customerPhone: row.customer_phone,
    addressStreet: row.address_street,
    addressPostcode: row.address_postcode,
    addressCity: row.address_city,
    notes: row.notes,
    subtotalCents: row.subtotal_cents,
    discountCents: row.discount_cents ?? 0,
    promoCode: row.promo_code,
    deliveryFeeCents: row.delivery_fee_cents,
    deliveryDate: row.delivery_date,
    deliverySlotStart: row.delivery_slot_start,
    deliverySlotEnd: row.delivery_slot_end,
    lines: (row.order_items ?? []).map((l) => ({
      id: l.id,
      slug: l.item_slug,
      name: l.name,
      quantity: l.quantity,
      unitPriceCents: l.unit_price_cents,
      options: l.options ?? [],
      instructions: l.instructions,
      lineTotalCents: l.line_total_cents,
    })),
  };
}

/**
 * Adds what staff changed on the order's lines (what a line replaced, the regular
 * price behind a compensation). Only for the places that print or show a single
 * order to a person; a list of orders doesn't need it. No-op if there is nothing.
 */
async function withLineExtras(summary: OrderSummary): Promise<OrderSummary> {
  const extras = await fetchLineExtras(summary.id);
  if (extras.size === 0) return summary;
  return {
    ...summary,
    lines: summary.lines.map((l) => {
      const extra = l.id ? extras.get(l.id) : undefined;
      return extra ? { ...l, replaces: extra.replaces, listUnitPriceCents: extra.listUnitPriceCents } : l;
    }),
  };
}

export async function getOrderSummaryById(id: string): Promise<OrderSummary | null> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return withLineExtras(mapOrderRow(data as unknown as OrderRow));
}

export async function getOrderByReference(
  reference: string
): Promise<OrderSummary | null> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("reference", reference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return withLineExtras(mapOrderRow(data as unknown as OrderRow));
}

async function getOrderByMolliePaymentId(
  molliePaymentId: string
): Promise<OrderSummary | null> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("mollie_payment_id", molliePaymentId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapOrderRow(data as unknown as OrderRow);
}

/** A signed-in customer's own order history, newest first. */
export async function listCustomerOrders(
  customerId: string
): Promise<OrderSummary[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("customer_id", customerId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOrderRow(row as unknown as OrderRow));
}

/**
 * The dish names for a customer-facing receipt or email, in their language.
 *
 * Order lines snapshot the Dutch name — it's what the kitchen reads, and it
 * keeps a past order saying what it said. An English customer's receipt
 * should still read in English, so names are looked up again by slug and
 * swapped for the English name where one exists. A dish that's since been
 * deleted just keeps its snapshot.
 */
export async function localizeLineNames(
  lines: ReceiptLine[],
  locale: string
): Promise<ReceiptLine[]> {
  if (locale !== "en") return lines;
  try {
    const { items } = await readStore();
    const english = new Map(items.map((i) => [i.slug, i.nameEn?.trim()]));
    return lines.map((l) => ({ ...l, name: english.get(l.slug) || l.name }));
  } catch {
    return lines;
  }
}
