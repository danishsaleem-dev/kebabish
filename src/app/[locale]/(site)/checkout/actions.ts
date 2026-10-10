"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { routing } from "@/i18n/routing";
import { auth } from "@/lib/auth";
import { siteConfig } from "@/lib/site-config";
import { createPayment } from "@/lib/mollie";
import { orderAccessToken } from "@/lib/order-token";
import {
  CartPricingError,
  attachPayment,
  createOrder,
  deliveryFeeCents,
  isDeliverableTown,
  priceCart,
  validatePromoCode,
  type SubmittedLine,
  type PromoError,
} from "@/lib/orders";
import { readStore } from "@/lib/admin/store";
import { toCents } from "@/lib/money";
import {
  generateDaySlots,
  isPastCutoff,
  amsterdamNow,
  weekdayForDateKey,
  BOOKING_WINDOW_DAYS,
} from "@/lib/delivery-slots";
import { reserveDeliverySlot, releaseDeliverySlot } from "@/lib/delivery-slots-data";

export interface CheckoutState {
  ok: boolean;
  /** Message key under the `checkout` namespace, resolved by the client. */
  error?: string;
  values?: Record<string, string>;
}

/** The origin this request actually came in on. */
async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const proto =
    list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

const checkoutSchema = z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  phone: z.string().trim().min(6),
  street: z.string().trim().min(3),
  postcode: z.string().trim().min(4),
  city: z.string().trim().min(2),
  notes: z.string().trim().max(500).default(""),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  deliverySlotStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  deliverySlotEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

export interface PromoState {
  ok: boolean;
  code?: string;
  discountCents?: number;
  error?: PromoError;
}

/**
 * Live "Apply" preview on the checkout page — no email yet, so the
 * single-use-per-customer check is skipped here and re-enforced for real
 * inside `checkoutAction` below. Never trusted for the actual charge.
 */
export async function checkPromoCodeAction(
  code: string,
  subtotalCents: number
): Promise<PromoState> {
  const result = await validatePromoCode(code, subtotalCents);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, code: result.code, discountCents: result.discountCents };
}

/**
 * Turn a cart into a paid-for order.
 *
 * Everything that decides money is recomputed here — prices, extras,
 * delivery fee, minimum order, whether we even deliver to that town. The
 * browser only says *what* was ordered.
 */
export async function checkoutAction(
  _prev: CheckoutState,
  formData: FormData
): Promise<CheckoutState> {
  const parsed = checkoutSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    street: formData.get("street") ?? "",
    postcode: formData.get("postcode") ?? "",
    city: formData.get("city") ?? "",
    notes: formData.get("notes") ?? "",
    deliveryDate: formData.get("deliveryDate") ?? "",
    deliverySlotStart: formData.get("deliverySlotStart") ?? "",
    deliverySlotEnd: formData.get("deliverySlotEnd") ?? "",
  });

  if (!parsed.success) return { ok: false, error: "invalidDetails" };
  const details = parsed.data;
  const locale = String(formData.get("locale") ?? "");

  let submitted: SubmittedLine[];
  try {
    submitted = JSON.parse(String(formData.get("cart") ?? "[]"));
  } catch {
    return { ok: false, error: "emptyCart" };
  }
  if (!Array.isArray(submitted) || submitted.length === 0) {
    return { ok: false, error: "emptyCart" };
  }

  if (!isDeliverableTown(details.city)) {
    return { ok: false, error: "outsideArea" };
  }

  // The slot picker on the page already only ever offers real, open,
  // available slots — this re-derives and re-checks every bit of that
  // from scratch server-side, the same "never trust the client" rule as
  // everything else here. A stale/tampered submission (page left open
  // past the cutoff, a slot that just filled up, hours that changed
  // underneath it) gets caught here, not assumed valid because the form
  // said so.
  const store = await readStore();

  // The owner's "Taking orders" switch has to hold on the server too, not
  // just hide the Add buttons — a cart that was filled earlier, or a direct
  // POST, would otherwise sail straight through. Opening hours are
  // deliberately *not* checked: booking a later slot while closed is allowed.
  if (!store.settings.acceptingOrders) {
    return { ok: false, error: "notAccepting" };
  }

  const now = amsterdamNow();
  const weekday = weekdayForDateKey(details.deliveryDate);

  if (details.deliveryDate < now.dateKey) {
    return { ok: false, error: "slotUnavailable" };
  }
  const daysAhead = Math.round(
    (Date.parse(`${details.deliveryDate}T00:00:00Z`) -
      Date.parse(`${now.dateKey}T00:00:00Z`)) /
      86_400_000
  );
  if (daysAhead >= BOOKING_WINDOW_DAYS) {
    return { ok: false, error: "slotUnavailable" };
  }

  const day = store.settings.hours.find((h) => h.day === weekday);
  const validSlot = day
    ? generateDaySlots(day).some(
        (s) => s.start === details.deliverySlotStart && s.end === details.deliverySlotEnd
      )
    : false;
  if (!validSlot || isPastCutoff(details.deliveryDate, details.deliverySlotStart, now)) {
    return { ok: false, error: "slotUnavailable" };
  }

  const reserved = await reserveDeliverySlot(
    details.deliveryDate,
    weekday,
    details.deliverySlotStart
  );
  if (!reserved) {
    return { ok: false, error: "slotFull" };
  }

  // From here on, a reserved slot is on the line — anything that bails out
  // has to hand it back, or a cart that turns out invalid/underpriced
  // still quietly eats a real kitchen slot.
  const releaseSlot = () =>
    releaseDeliverySlot(details.deliveryDate, details.deliverySlotStart);

  let cart;
  try {
    cart = await priceCart(submitted);
  } catch (error) {
    await releaseSlot();
    if (error instanceof CartPricingError) {
      return { ok: false, error: "priceChanged" };
    }
    throw error;
  }

  if (cart.subtotalCents < toCents(store.settings.minimumOrder)) {
    await releaseSlot();
    return { ok: false, error: "belowMinimum" };
  }

  const fee = await deliveryFeeCents(cart.subtotalCents);

  // Re-validate the promo code against the real, server-priced subtotal —
  // the amount the client "applied" earlier was only ever a preview. An
  // empty field is not an error: promo codes are optional.
  const submittedPromo = String(formData.get("promoCode") ?? "").trim();
  let promoCode: string | null = null;
  let discountCents = 0;
  if (submittedPromo) {
    const promo = await validatePromoCode(
      submittedPromo,
      cart.subtotalCents,
      details.email
    );
    if (!promo.ok) {
      await releaseSlot();
      return { ok: false, error: "promoInvalid" };
    }
    promoCode = promo.code;
    discountCents = promo.discountCents;
  }

  // Attach the order to a signed-in customer so it shows on their
  // dashboard; guests check out fine without one.
  const session = await auth();
  const customerId =
    session?.user?.role === "customer" ? (session.user.id ?? null) : null;

  const order = await createOrder({
    customerId,
    customerName: details.name,
    customerEmail: details.email,
    customerPhone: details.phone,
    addressStreet: details.street,
    addressPostcode: details.postcode,
    addressCity: details.city,
    notes: details.notes || null,
    cart,
    deliveryFeeCents: fee,
    promoCode,
    discountCents,
    deliveryDate: details.deliveryDate,
    deliverySlotStart: details.deliverySlotStart,
    deliverySlotEnd: details.deliverySlotEnd,
  });

  // Return to whichever origin the customer is actually on — localhost in
  // dev, the preview URL on a preview deploy, the real domain in
  // production. NEXT_PUBLIC_SITE_URL alone would send a developer testing
  // locally to the live site.
  const base = await requestOrigin();
  const isPublic = base.startsWith("https://");
  const reference = encodeURIComponent(order.reference);
  // Default locale is unprefixed; anything else needs its segment or an
  // English customer lands on the Dutch confirmation page.
  const prefix = locale && locale !== routing.defaultLocale ? `/${locale}` : "";

  let checkoutUrl: string | null = null;
  try {
    const payment = await createPayment({
      amountCents: order.totalCents,
      description: `${siteConfig.brandName} ${order.reference}`,
      redirectUrl: `${base}${prefix}/checkout/complete?ref=${reference}&t=${orderAccessToken(order.reference)}`,
      // Mollie rejects non-public webhook URLs, so local dev omits it and
      // relies on the return page polling instead.
      webhookUrl: isPublic ? `${base}/api/mollie/webhook` : undefined,
      metadata: { orderReference: order.reference },
    });

    await attachPayment(order.id, payment.id);
    checkoutUrl = payment.checkoutUrl;
  } catch (error) {
    console.error("[checkout] Mollie payment failed:", error);
    await releaseSlot();
    return { ok: false, error: "failed" };
  }

  if (!checkoutUrl) {
    await releaseSlot();
    return { ok: false, error: "failed" };
  }

  // redirect() throws, so it must sit outside the try above or it would be
  // caught and reported as a payment failure.
  redirect(checkoutUrl);
}
