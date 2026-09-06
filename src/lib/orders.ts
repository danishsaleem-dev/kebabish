import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { readStore } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";
import { toCents } from "@/lib/money";
import type { MolliePaymentStatus } from "@/lib/mollie";
import { toPaymentStatus } from "@/lib/mollie";
import type { StoredPromoCode } from "@/lib/admin/store/types";

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
    if (item.soldOut) throw new CartPricingError("soldOut");
    // A dish with no price can't be checked out — the UI never offers it,
    // so reaching here means the cart is stale or hand-edited.
    if (item.price == null) throw new CartPricingError("unpriced");

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

export type PromoError = "notFound" | "expired" | "belowMinimum" | "alreadyUsed";

export type PromoValidation =
  | { ok: true; code: string; discountCents: number }
  | { ok: false; error: PromoError };

/**
 * Validate a promo code against the server-priced subtotal.
 *
 * Called twice: once from the checkout page (no `customerEmail` yet, so the
 * single-use check is skipped) as a live preview while typing, and again
 * inside `checkoutAction` with the real email, which is the only check that
 * actually gates payment — never trust the client's own "applied" state for
 * money, same as `priceCart`.
 */
export async function validatePromoCode(
  rawCode: string,
  subtotalCents: number,
  customerEmail?: string
): Promise<PromoValidation> {
  const { promoCodes } = await readStore();
  const code = rawCode.trim().toUpperCase();
  const promo = (promoCodes ?? []).find((p) => p.code === code);

  if (!promo || !promo.active) return { ok: false, error: "notFound" };

  if (promo.expiresAt) {
    const today = new Date().toISOString().slice(0, 10);
    if (promo.expiresAt < today) return { ok: false, error: "expired" };
  }

  if (promo.minOrder != null && subtotalCents < toCents(promo.minOrder)) {
    return { ok: false, error: "belowMinimum" };
  }

  if (promo.singleUsePerCustomer && customerEmail) {
    const used = await promoAlreadyUsedBy(promo.code, customerEmail);
    if (used) return { ok: false, error: "alreadyUsed" };
  }

  const discountCents = discountFor(promo, subtotalCents);
  return { ok: true, code: promo.code, discountCents };
}

function discountFor(promo: StoredPromoCode, subtotalCents: number): number {
  const raw =
    promo.type === "percentage"
      ? Math.round((subtotalCents * promo.value) / 100)
      : toCents(promo.value);
  return Math.min(Math.max(raw, 0), subtotalCents);
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

/** #KB-000000 — short enough to read down the phone. */
function newReference(): string {
  return `#KB-${Math.floor(100000 + Math.random() * 900000)}`;
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
}

export async function createOrder(input: CreateOrderInput) {
  const supabase = supabaseAdmin();
  const totalCents = Math.max(
    input.cart.subtotalCents - input.discountCents + input.deliveryFeeCents,
    0
  );

  // The reference is unique in the database; on the rare collision, try a
  // new one rather than failing someone's checkout.
  for (let attempt = 0; attempt < 5; attempt++) {
    const reference = newReference();

    const { data, error } = await supabase
      .from("orders")
      .insert({
        reference,
        customer_id: input.customerId,
        customer_name: input.customerName,
        customer_email: input.customerEmail,
        customer_phone: input.customerPhone,
        fulfilment: "delivery",
        address_street: input.addressStreet,
        address_postcode: input.addressPostcode,
        address_city: input.addressCity,
        notes: input.notes,
        subtotal_cents: input.cart.subtotalCents,
        delivery_fee_cents: input.deliveryFeeCents,
        promo_code: input.promoCode,
        discount_cents: input.discountCents,
        total_cents: totalCents,
      })
      .select("id, reference")
      .single();

    if (error) {
      if (error.code === "23505") continue; // duplicate reference
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
 * webhook fires still sees the right thing.
 */
export async function syncPaymentStatus(
  molliePaymentId: string,
  status: MolliePaymentStatus
) {
  const mapped = toPaymentStatus(status);
  const { error } = await supabaseAdmin()
    .from("orders")
    .update({
      payment_status: mapped,
      paid_at: mapped === "paid" ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("mollie_payment_id", molliePaymentId);

  if (error) throw new Error(error.message);
  return mapped;
}

export interface OrderSummary {
  reference: string;
  status: string;
  paymentStatus: string;
  totalCents: number;
  molliePaymentId: string | null;
  fulfilment: "delivery" | "pickup";
}

export async function getOrderByReference(
  reference: string
): Promise<OrderSummary | null> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(
      "reference, status, payment_status, total_cents, mollie_payment_id, fulfilment"
    )
    .eq("reference", reference)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  return {
    reference: data.reference,
    status: data.status,
    paymentStatus: data.payment_status,
    totalCents: data.total_cents,
    molliePaymentId: data.mollie_payment_id,
    fulfilment: data.fulfilment,
  };
}
