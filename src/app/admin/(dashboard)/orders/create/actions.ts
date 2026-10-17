"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { z } from "zod";
import { requireRole, OWNER_STAFF_MANAGER } from "@/lib/admin/guard";
import { flashRedirect } from "@/lib/admin/flash";
import {
  CartPricingError,
  attachPayment,
  createOrder,
  deliveryFeeCents,
  getOrderSummaryById,
  markOrderPaymentFailed,
  priceCart,
  validatePromoCode,
  type PricedCart,
  type PromoError,
  type SubmittedLine,
} from "@/lib/orders";
import { createPayment } from "@/lib/mollie";
import { orderAccessToken } from "@/lib/order-token";
import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import { readStore } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";
import {
  DEFAULT_SLOT_MINUTES,
  amsterdamLocalToUtc,
  amsterdamNow,
  effectiveHours,
  generateDaySlots,
  weekdayForDateKey,
} from "@/lib/delivery-slots";
import { releaseDeliverySlot, reserveDeliverySlot } from "@/lib/delivery-slots-data";

export interface ManualOrderState {
  ok: boolean;
  /** A message to show above the form when something went wrong. */
  error?: string;
  /** Field-level messages. */
  errors?: Record<string, string>;
  /** Set once the order exists and a payment link had to be made for it. */
  created?: { id: string; reference: string; paymentLink: string };
}

/**
 * How the payment is being handled, as the form's radio buttons offer it.
 * Each maps to a payment method, whether it's already settled, and whether
 * the order goes straight to the kitchen. Only the online link waits for the
 * customer to pay first (the kitchen's new-order popup fires when they do);
 * everything else is an order staff took themselves, so it starts accepted.
 */
const PAYMENT_CHOICES = {
  mollie_link: { method: "mollie", paid: false, accepted: false },
  cash: { method: "cash", paid: false, accepted: true },
  bank_transfer: { method: "bank_transfer", paid: false, accepted: true },
  unpaid: { method: "unpaid", paid: false, accepted: true },
  paid_cash: { method: "cash", paid: true, accepted: true },
  paid_bank: { method: "bank_transfer", paid: true, accepted: true },
} as const;

const schema = z.object({
  customerName: z.string().trim().min(2, "Enter the customer's name."),
  phone: z.string().trim().min(6, "Enter a phone number."),
  email: z.union([z.literal(""), z.string().trim().email("That doesn't look like an email address.")]),
  street: z.string().trim().min(2, "Enter the street."),
  houseNumber: z.string().trim().min(1, "Enter the house number.").max(20),
  addition: z.string().trim().max(20).default(""),
  postcode: z.string().trim().min(4, "Enter the postcode."),
  city: z.string().trim().min(2, "Enter the town."),
  notes: z.string().trim().max(500, "Keep the note under 500 characters.").default(""),
  deliveryDate: z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]),
  slot: z.union([z.literal(""), z.string().regex(/^\d\d:\d\d\|\d\d:\d\d$/)]),
  deliveryTime: z.union([z.literal(""), z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Enter a time like 18:30.")]),
  alreadyDelivered: z.boolean(),
  channel: z.enum(["website", "whatsapp", "phone", "other"]),
  channelNote: z.string().trim().max(50, "Keep this under 50 characters.").default(""),
  payment: z.enum(["mollie_link", "cash", "bank_transfer", "unpaid", "paid_cash", "paid_bank"]),
  promoCode: z.string().trim().max(40).default(""),
  deliveryFee: z.string().trim().max(10).default(""),
  adminDiscount: z.string().trim().max(10).default(""),
  waiveDelivery: z.boolean(),
});

async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const proto =
    list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/** Euros typed by a person ("12,50", "12.5") -> cents, or null if it isn't a sensible amount. */
function eurosToCents(raw: unknown, max = 1000): number | null {
  const text = String(raw ?? "").trim().replace(",", ".");
  if (text === "") return null;
  const euros = Number(text);
  if (!Number.isFinite(euros) || euros < 0 || euros > max) return null;
  return Math.round(euros * 100);
}

/**
 * Staff may set the price they actually agreed for a dish. The form sends the dish and
 * its choices, plus — only where staff changed it — `price`, the price of one portion
 * *including* its extras. That replaces the menu's price for the line (the chosen extras
 * stay listed on it, at no extra charge, so the line still totals exactly what was
 * agreed). Everything else in the line is still checked against the real menu.
 */
function applyPriceOverrides(cart: PricedCart, submitted: unknown[]): PricedCart {
  const lines = cart.lines.map((line, i) => {
    const sent = submitted[i] as { price?: unknown } | undefined;
    const cents = sent && sent.price !== undefined && sent.price !== null ? eurosToCents(sent.price) : null;
    if (cents === null) return line;
    return {
      ...line,
      unitPriceCents: cents,
      options: line.options.map((o) => ({ ...o, priceCents: 0 })),
      lineTotalCents: cents * line.quantity,
    };
  });
  return { lines, subtotalCents: lines.reduce((sum, l) => sum + l.lineTotalCents, 0) };
}

const PROMO_MESSAGES: Record<PromoError, string> = {
  notFound: "That code doesn't exist or is switched off.",
  expired: "That code had expired by then.",
  notStarted: "That code hadn't started yet.",
  belowMinimum: "The order is below that code's minimum.",
  alreadyUsed: "This customer has already used that code.",
  usedUp: "That code has been used up.",
  notFirstOrder: "That code is for a first order only.",
  notApplicable: "None of these dishes qualify for that code.",
};

function parseCart(raw: unknown): unknown[] {
  try {
    const parsed = JSON.parse(String(raw ?? "[]"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** The day a promo should be judged on: the day of the order, which may be in the past. */
function promoDay(deliveryDate: string): string | undefined {
  return deliveryDate && deliveryDate < amsterdamNow().dateKey ? deliveryDate : undefined;
}

export interface PromoPreview {
  ok: boolean;
  /** Euros taken off. */
  discount?: number;
  message?: string;
}

/**
 * The "Check" button next to the coupon box: what this code would take off this basket
 * (with the prices as staff have set them). The real check runs again when the order is
 * saved — this is only so the total can be shown before then.
 */
export async function checkManualPromoAction(
  cartJson: string,
  code: string,
  email: string,
  deliveryDate: string
): Promise<PromoPreview> {
  await requireRole(OWNER_STAFF_MANAGER);

  const submitted = parseCart(cartJson);
  if (submitted.length === 0) return { ok: false, message: "Add a dish first." };
  if (!code.trim()) return { ok: false, message: "Enter a code." };

  let cart: PricedCart;
  try {
    cart = applyPriceOverrides(await priceCart(submitted as SubmittedLine[]), submitted);
  } catch (error) {
    if (error instanceof CartPricingError) return { ok: false, message: "One of those dishes can't be ordered right now." };
    throw error;
  }

  const result = await validatePromoCode(code, cart, email.trim() || undefined, promoDay(deliveryDate));
  if (!result.ok) return { ok: false, message: PROMO_MESSAGES[result.error] };
  return { ok: true, discount: result.discountCents / 100 };
}

/**
 * Enter an order by hand — a phone call, a WhatsApp message, or something that
 * happened yesterday and was never put in the system.
 *
 * It goes through the same server-side pricing as a website checkout
 * (`priceCart`): the form says *what* was ordered and checks every dish against the
 * menu — a hidden, sold-out or unpriced dish is refused. What staff *can* do that a
 * customer can't: set the price they agreed for a dish (or the delivery fee), apply a
 * coupon, skip the minimum order, book without the customer-facing cutoff, take payment
 * in cash or by transfer, leave out an email address, and **enter a day that has already
 * passed** — the order is then filed under that date and time, and can be recorded as
 * delivered.
 */
export async function createManualOrderAction(
  _prev: ManualOrderState,
  formData: FormData
): Promise<ManualOrderState> {
  const session = await requireRole(OWNER_STAFF_MANAGER);

  const parsed = schema.safeParse({
    customerName: formData.get("customerName"),
    phone: formData.get("phone"),
    email: String(formData.get("email") ?? "").trim(),
    street: formData.get("street"),
    houseNumber: formData.get("houseNumber"),
    addition: formData.get("addition") ?? "",
    postcode: formData.get("postcode"),
    city: formData.get("city"),
    notes: formData.get("notes") ?? "",
    deliveryDate: String(formData.get("deliveryDate") ?? ""),
    slot: String(formData.get("slot") ?? ""),
    deliveryTime: String(formData.get("deliveryTime") ?? ""),
    alreadyDelivered: formData.get("alreadyDelivered") === "on",
    channel: formData.get("channel"),
    channelNote: formData.get("channelNote") ?? "",
    payment: formData.get("payment"),
    promoCode: String(formData.get("promoCode") ?? ""),
    deliveryFee: String(formData.get("deliveryFee") ?? ""),
    adminDiscount: String(formData.get("adminDiscount") ?? ""),
    waiveDelivery: formData.get("waiveDelivery") === "on",
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) errors[issue.path.join(".") || "form"] ??= issue.message;
    return { ok: false, errors };
  }
  const d = parsed.data;
  if (d.channel === "other" && !d.channelNote) {
    return { ok: false, errors: { channelNote: "Say where this order came from." } };
  }
  if ((d.slot || d.deliveryTime) && !d.deliveryDate) {
    return { ok: false, errors: { deliveryDate: "Pick the date." } };
  }

  const submitted = parseCart(formData.get("cart"));
  if (submitted.length === 0) {
    return { ok: false, error: "Add at least one dish." };
  }

  let cart: PricedCart;
  try {
    cart = applyPriceOverrides(await priceCart(submitted as SubmittedLine[]), submitted);
  } catch (error) {
    if (error instanceof CartPricingError) {
      return {
        ok: false,
        error:
          "One of those dishes can't be ordered right now (hidden, sold out, no price, or a required choice is missing).",
      };
    }
    throw error;
  }

  const choice = PAYMENT_CHOICES[d.payment];

  // ---- when: a future/today slot (capacity-checked), an exact time, or a day that has passed.
  const today = amsterdamNow().dateKey;
  const isPast = Boolean(d.deliveryDate) && d.deliveryDate < today;
  if (isPast && choice.method === "mollie" && !choice.paid) {
    return { ok: false, errors: { payment: "A payment link can't be sent for an order that already happened." } };
  }
  if (isPast && !d.deliveryTime) {
    return { ok: false, errors: { deliveryTime: "Enter the time it was ordered or delivered." } };
  }

  let slotStart: string | null = null;
  let slotEnd: string | null = null;
  let reserved = false;
  let placedAt: string | undefined;

  if (d.deliveryDate) {
    const store = await readStore();
    const weekday = weekdayForDateKey(d.deliveryDate);
    const resolved = effectiveHours(store.settings);
    const day = resolved.find((h) => h.day === weekday);

    if (!isPast && d.slot) {
      // A real slot for that day with room in it. The customer-facing cutoff is
      // deliberately not applied — staff can fit someone into a slot that's already running.
      const [start, end] = d.slot.split("|");
      const valid = day ? generateDaySlots(day).some((s) => s.start === start && s.end === end) : false;
      if (!valid) return { ok: false, errors: { slot: "That slot isn't offered on that day." } };

      reserved = await reserveDeliverySlot(d.deliveryDate, weekday, start);
      if (!reserved) return { ok: false, errors: { slot: "That slot is full or switched off." } };
      slotStart = start;
      slotEnd = end;
    } else if (d.deliveryTime) {
      // An exact time chosen by hand: no slot is reserved (staff know their own kitchen),
      // and the window is the usual slot length starting then.
      const [h, m] = d.deliveryTime.split(":").map(Number);
      const length = day?.slotMinutes ?? DEFAULT_SLOT_MINUTES;
      const endMinutes = Math.min(h * 60 + m + length, 23 * 60 + 59);
      slotStart = d.deliveryTime;
      slotEnd = `${String(Math.floor(endMinutes / 60)).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
    }

    // An order entered after the fact is filed at the time it happened, so it lands on the
    // right day in the order list and in reports.
    if (isPast && d.deliveryTime) placedAt = amsterdamLocalToUtc(d.deliveryDate, d.deliveryTime).toISOString();
  }
  const releaseSlot = () =>
    reserved && slotStart && d.deliveryDate ? releaseDeliverySlot(d.deliveryDate, slotStart) : undefined;

  // ---- money: a coupon, and a delivery fee that staff may set.
  let promoCode: string | null = null;
  let discountCents = 0;
  if (d.promoCode) {
    const result = await validatePromoCode(d.promoCode, cart, d.email || undefined, promoDay(d.deliveryDate));
    if (!result.ok) {
      await releaseSlot();
      return { ok: false, errors: { promoCode: PROMO_MESSAGES[result.error] } };
    }
    promoCode = result.code;
    discountCents = result.discountCents;
  }

  // A discount staff type in themselves (a "let's say \u20AC5 off"), on top of any coupon. It is
  // taken off the dishes, never more than they come to, so the total can't go below the delivery fee.
  const typedDiscount = d.adminDiscount === "" ? 0 : eurosToCents(d.adminDiscount, 1000);
  if (typedDiscount === null) {
    await releaseSlot();
    return { ok: false, errors: { adminDiscount: "Enter an amount like 5 or 2,50 \u2014 or leave it empty." } };
  }
  discountCents = Math.min(discountCents + typedDiscount, cart.subtotalCents);

  const typedFee = d.deliveryFee === "" ? null : eurosToCents(d.deliveryFee, 100);
  if (d.deliveryFee !== "" && typedFee === null) {
    await releaseSlot();
    return { ok: false, errors: { deliveryFee: "Enter an amount like 2,50 — or leave it empty." } };
  }
  const fee = d.waiveDelivery ? 0 : typedFee ?? (await deliveryFeeCents(cart.subtotalCents));

  let order;
  try {
    order = await createOrder({
      customerId: null,
      customerName: d.customerName,
      customerEmail: d.email,
      customerPhone: d.phone,
      addressStreet: [d.street, d.houseNumber, d.addition].filter(Boolean).join(" "),
      addressPostcode: d.postcode,
      addressCity: d.city,
      notes: d.notes || null,
      cart,
      deliveryFeeCents: fee,
      promoCode,
      discountCents,
      deliveryDate: d.deliveryDate && slotStart ? d.deliveryDate : null,
      deliverySlotStart: slotStart,
      deliverySlotEnd: slotEnd,
      locale: "nl",
      marketingOptIn: false,
      manual: {
        channel: d.channel,
        channelNote: d.channel === "other" ? d.channelNote : null,
        paymentMethod: choice.method,
        paid: choice.paid,
        accepted: choice.accepted,
        createdBy: session.user.id,
        ...(isPast ? { placedAt, delivered: d.alreadyDelivered } : {}),
      },
    });
  } catch (error) {
    await releaseSlot();
    console.error("[manual-order] could not create the order:", error);
    return { ok: false, error: "Couldn't save the order — nothing was created. Please try again." };
  }

  // An online payment link: made now, shown to staff to send to the customer.
  if (d.payment === "mollie_link") {
    try {
      const base = await requestOrigin();
      const payment = await createPayment({
        amountCents: order.totalCents,
        description: `${siteConfig.brandName} ${order.reference}`,
        redirectUrl: `${base}/checkout/complete?ref=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}`,
        webhookUrl: base.startsWith("https://") ? `${base}/api/mollie/webhook` : undefined,
        metadata: { orderReference: order.reference, locale: "nl" },
      });
      await attachPayment(order.id, payment.id);
      if (!payment.checkoutUrl) throw new Error("Mollie returned no payment link.");
      return {
        ok: true,
        created: { id: order.id, reference: order.reference, paymentLink: payment.checkoutUrl },
      };
    } catch (error) {
      console.error("[manual-order] could not create the payment link:", error);
      await releaseSlot();
      await markOrderPaymentFailed(order.id);
      return {
        ok: false,
        error: `The order ${order.reference} was saved but the payment link couldn't be made, so it was closed. Try again, or choose another payment option.`,
      };
    }
  }

  // Already paid and the customer gave an email: send the confirmation — but not for an
  // order that already happened, where a receipt arriving now would only confuse.
  if (choice.paid && d.email && !isPast) {
    const summary = await getOrderSummaryById(order.id);
    if (summary) after(() => sendOrderConfirmationEmail(summary, summary.locale));
  }

  redirect(flashRedirect(`/admin/orders/${order.id}`, `Order ${order.reference} created.`));
}
