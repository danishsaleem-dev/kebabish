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
  type SubmittedLine,
} from "@/lib/orders";
import { createPayment } from "@/lib/mollie";
import { orderAccessToken } from "@/lib/order-token";
import { sendOrderConfirmationEmail } from "@/lib/email/order-confirmation";
import { readStore } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";
import { generateDaySlots, amsterdamNow, weekdayForDateKey } from "@/lib/delivery-slots";
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
  channel: z.enum(["website", "whatsapp", "phone", "other"]),
  channelNote: z.string().trim().max(50, "Keep this under 50 characters.").default(""),
  payment: z.enum(["mollie_link", "cash", "bank_transfer", "unpaid", "paid_cash", "paid_bank"]),
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

/**
 * Enter an order by hand — a phone call, a WhatsApp message.
 *
 * It goes through the same server-side pricing as a website checkout
 * (`priceCart`): the form only says *what* was ordered, never what it costs,
 * and a hidden, sold-out or unpriced dish is refused. What staff *can* do
 * that a customer can't: waive the delivery fee, skip the minimum order,
 * book without the customer-facing cutoff, take payment in cash or by
 * transfer, and leave out an email address.
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
    channel: formData.get("channel"),
    channelNote: formData.get("channelNote") ?? "",
    payment: formData.get("payment"),
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
  if (d.slot && !d.deliveryDate) {
    return { ok: false, errors: { deliveryDate: "Pick the delivery date." } };
  }

  let submitted: SubmittedLine[];
  try {
    submitted = JSON.parse(String(formData.get("cart") ?? "[]"));
  } catch {
    submitted = [];
  }
  if (!Array.isArray(submitted) || submitted.length === 0) {
    return { ok: false, error: "Add at least one dish." };
  }

  let cart;
  try {
    cart = await priceCart(submitted);
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

  // The slot, if one was chosen: it has to be a real window for that day and
  // have room. The customer-facing cutoff is deliberately not applied — staff
  // can fit someone into a slot that's already running.
  let slotStart: string | null = null;
  let slotEnd: string | null = null;
  let reserved = false;
  if (d.deliveryDate && d.slot) {
    const [start, end] = d.slot.split("|");
    const store = await readStore();
    if (d.deliveryDate < amsterdamNow().dateKey) {
      return { ok: false, errors: { deliveryDate: "That date has already passed." } };
    }
    const weekday = weekdayForDateKey(d.deliveryDate);
    const day = store.settings.hours.find((h) => h.day === weekday);
    const valid = day ? generateDaySlots(day).some((s) => s.start === start && s.end === end) : false;
    if (!valid) return { ok: false, errors: { slot: "That slot isn't offered on that day." } };

    reserved = await reserveDeliverySlot(d.deliveryDate, weekday, start);
    if (!reserved) return { ok: false, errors: { slot: "That slot is full or switched off." } };
    slotStart = start;
    slotEnd = end;
  }
  const releaseSlot = () =>
    reserved && slotStart && d.deliveryDate ? releaseDeliverySlot(d.deliveryDate, slotStart) : undefined;

  const choice = PAYMENT_CHOICES[d.payment];
  const fee = d.waiveDelivery ? 0 : await deliveryFeeCents(cart.subtotalCents);

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
      promoCode: null,
      discountCents: 0,
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

  // Already paid and the customer gave an email: send the confirmation.
  if (choice.paid && d.email) {
    const summary = await getOrderSummaryById(order.id);
    if (summary) after(() => sendOrderConfirmationEmail(summary, summary.locale));
  }

  redirect(flashRedirect(`/admin/orders/${order.id}`, `Order ${order.reference} created.`));
}
