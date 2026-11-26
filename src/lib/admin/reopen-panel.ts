import "server-only";
import { amsterdamNow } from "@/lib/delivery-slots";
import { formatEuro } from "@/lib/money";
import { orderPaymentUrl } from "@/lib/order-payment-url";
import { getOrderForRetry, getOrderSummaryById } from "@/lib/orders";
import { canPayAgain, payableUntil, RETRYABLE_PAYMENT } from "@/lib/payment-window";
import { getPaymentReopen } from "@/lib/payment-reopen";
import { whatsappDigits } from "@/lib/phone";

/**
 * What the order page's "Payment" panel shows — or null for an order with nothing to
 * reopen (paid, cancelled, or not an online payment).
 */
export async function getReopenPanel(order: { id: string; reference: string }) {
  const unpaid = await getOrderForRetry(order.reference);
  if (!unpaid || unpaid.status === "cancelled") return null;
  if (unpaid.paymentMethod !== "mollie" && unpaid.paymentMethod !== "payment_link") return null;
  const inProgress = unpaid.paymentStatus === "open";
  // A payment-link order that is still waiting has its own "Mark as paid" box.
  if (inProgress && unpaid.paymentMethod !== "mollie") return null;
  if (!inProgress && !RETRYABLE_PAYMENT.includes(unpaid.paymentStatus)) return null;

  const summary = await getOrderSummaryById(order.id);
  if (!summary) return null;
  const reopen = await getPaymentReopen(order.id);
  const link = orderPaymentUrl(summary.reference, summary.locale);
  const until = canPayAgain(unpaid, reopen) ? payableUntil(unpaid.createdAt, reopen) : null;
  const format = (date: Date, locale: string) =>
    date.toLocaleString(locale, {
      timeZone: "Europe/Amsterdam",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  const nl = summary.locale !== "en";
  const amount = formatEuro(summary.totalCents / 100);
  const message = until
    ? nl
      ? `Hoi ${summary.customerName}, je kunt je bestelling ${summary.reference} (${amount}) alsnog betalen via deze link, tot ${format(until, "nl-NL")}: ${link}`
      : `Hi ${summary.customerName}, you can still pay for your order ${summary.reference} (${amount}) with this link, until ${format(until, "en-GB")}: ${link}`
    : "";

  const now = amsterdamNow();
  const { deliveryDate: date, deliverySlotStart: start, deliverySlotEnd: end } = unpaid;
  const ended =
    !date ||
    !end ||
    date < now.dateKey ||
    (date === now.dateKey && now.minutes >= Number(end.slice(0, 2)) * 60 + Number(end.slice(3, 5)));

  return {
    orderId: order.id,
    reference: order.reference,
    today: now.dateKey,
    current: !ended && start ? { date: date!, start, end: end! } : null,
    inProgress,
    payableLabel: until ? `until ${format(until, "en-GB")}` : null,
    link,
    whatsappHref:
      until && summary.customerPhone
        ? `https://wa.me/${whatsappDigits(summary.customerPhone)}?text=${encodeURIComponent(message)}`
        : null,
  };
}
