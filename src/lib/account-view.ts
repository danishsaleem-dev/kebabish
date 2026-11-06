import "server-only";
import { formatEuro, fromCents } from "@/lib/money";
import { orderAccessToken } from "@/lib/order-token";
import type { OrderSummary, ReceiptLine } from "@/lib/orders";
import type { LedgerRow } from "@/lib/rewards";
import type { AccountLocale } from "@/lib/account-page";
import type { HistoryEntry } from "@/components/dashboard/RewardsCard";
import type { OrderCardLink } from "@/components/dashboard/OrderCard";

/**
 * Turns orders and ledger rows into the plain strings the dashboard's
 * components take. Every component down there is presentational, so all the
 * formatting — language, Amsterdam dates, euros, pluralisation — happens
 * once, here, on the server.
 */

/**
 * next-intl's translator. The project doesn't augment `IntlMessages`, so a
 * plain signature is enough and the pages can pass `t` straight in.
 */
export type Translate = (key: string, values?: Record<string, string | number>) => string;

const TAG: Record<AccountLocale, string> = { nl: "nl-NL", en: "en-GB" };

/** The kitchen's clock, not the visitor's — the same rule as everywhere else. */
const ZONE = "Europe/Amsterdam";

export function formatNumber(locale: AccountLocale): (value: number) => string {
  return (value) => value.toLocaleString(TAG[locale]);
}

/** "6 november 2026" — when an order was placed. */
export function formatLongDate(locale: AccountLocale): (iso: string) => string {
  return (iso) =>
    new Date(iso).toLocaleDateString(TAG[locale], {
      timeZone: ZONE,
      day: "numeric",
      month: "long",
      year: "numeric",
    });
}

/** "6 nov 2026" — compact, for ledger rows. */
export function formatShortDate(locale: AccountLocale): (iso: string) => string {
  return (iso) =>
    new Date(iso).toLocaleDateString(TAG[locale], {
      timeZone: ZONE,
      day: "numeric",
      month: "short",
      year: "numeric",
    });
}

/**
 * "vrijdag 6 november, 18:15–19:00". A delivery date is a calendar label,
 * not an instant, so it is read at midnight local time and never parsed as
 * UTC — the same care the checkout day picker takes.
 */
export function formatDeliveryWindow(
  locale: AccountLocale,
  order: Pick<OrderSummary, "deliveryDate" | "deliverySlotStart" | "deliverySlotEnd">
): string | null {
  if (!order.deliveryDate || !order.deliverySlotStart) return null;
  const day = new Date(`${order.deliveryDate}T00:00:00`).toLocaleDateString(TAG[locale], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return `${day}, ${order.deliverySlotStart}–${order.deliverySlotEnd}`;
}

/* ------------------------------------------------------------------ orders */

/** The `/en` prefix the public site needs for the language this order was placed in. */
function orderPrefix(order: Pick<OrderSummary, "locale">): string {
  return order.locale === "en" ? "/en" : "";
}

/** Order again: the public menu reads these two parameters, rebuilds the basket and opens it. */
export function reorderHref(order: Pick<OrderSummary, "locale" | "reference">): string {
  return `${orderPrefix(order)}/menu?reorder=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}`;
}

export function feedbackHref(
  order: Pick<OrderSummary, "locale" | "reference">,
  source: "dashboard"
): string {
  return `${orderPrefix(order)}/feedback?order=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}&src=${source}`;
}

export function invoiceHref(order: Pick<OrderSummary, "reference">): string {
  return `/api/invoice?ref=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}&download=1`;
}

export function orderDetailsHref(order: Pick<OrderSummary, "locale" | "reference">): string {
  return `${orderPrefix(order)}/checkout/complete?ref=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}`;
}

/** Only a paid (or since-refunded) order has an invoice and can be reordered. */
export function wasPaid(order: Pick<OrderSummary, "paymentStatus">): boolean {
  return order.paymentStatus === "paid" || order.paymentStatus === "refunded";
}

export type StatusPill = { label: string; tone: "success" | "danger" | "warn" | "neutral" };

/**
 * The pill on a past order, in the customer's own vocabulary — not the
 * kitchen's. Staff statuses like "ready" never reach here, because an order
 * mid-flight is shown by the live tracker instead.
 */
export function orderStatusPill(
  order: Pick<OrderSummary, "status" | "paymentStatus" | "refundedCents" | "totalCents">,
  t: Translate
): StatusPill {
  if (order.status === "cancelled") return { label: t("statusCancelled"), tone: "danger" };
  if (order.paymentStatus === "refunded") return { label: t("statusRefunded"), tone: "neutral" };
  if (order.refundedCents > 0) return { label: t("statusPartRefunded"), tone: "neutral" };
  if (order.paymentStatus !== "paid") return { label: t("statusAwaitingPayment"), tone: "warn" };
  if (order.status === "delivered") return { label: t("stepDelivered"), tone: "success" };
  return { label: t("stepReceived"), tone: "neutral" };
}

/** The dish lines, with their chosen options joined into one line of text. */
export function orderCardLines(
  lines: ReceiptLine[]
): { quantity: number; name: string; options: string; total: string }[] {
  return lines.map((line) => ({
    quantity: line.quantity,
    name: line.name,
    options: line.options.map((option) => option.optionLabel).join(", "),
    total: formatEuro(fromCents(line.lineTotalCents)),
  }));
}

export function creditNoteLinks(
  order: Pick<OrderSummary, "reference">,
  notes: { number: string; amountCents: number }[],
  t: Translate
): OrderCardLink[] {
  return notes.map((note) => ({
    label: t("orderCreditNote", {
      number: note.number,
      amount: formatEuro(fromCents(note.amountCents)),
    }),
    href: `/api/credit-note?ref=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}&n=${encodeURIComponent(note.number)}&download=1`,
  }));
}

/* ------------------------------------------------------------------ points */

/**
 * What one order did to the customer's points: what they spent, what they
 * earned, and — for an order still on its way — what is coming once it is
 * delivered. Returns null when there is nothing to say.
 */
export function orderPointsNote(
  used: number,
  earned: number,
  coming: number,
  t: Translate,
  n: (value: number) => string
): string | null {
  const parts = [
    ...(used > 0 ? [t("orderPointsUsed", { points: n(used) })] : []),
    ...(earned > 0 ? [t("orderPointsEarned", { points: n(earned) })] : []),
    ...(coming > 0 ? [t("orderPointsComing", { points: n(coming) })] : []),
  ];
  return parts.length > 0 ? parts.join(" · ") : null;
}

/** The customer's words for one ledger movement. A referral never says whose order it was. */
export function ledgerHeadline(row: LedgerRow, t: Translate, n: (value: number) => string): string {
  const points = n(Math.abs(row.points));
  const order = row.orderReference;
  switch (row.kind) {
    case "earn":
      return order
        ? t("ledgerEarnOn", { points, order })
        : t("ledgerEarn", { points });
    case "welcome":
      return t("ledgerWelcome", { points });
    case "redeem":
      return order
        ? t("ledgerRedeemOn", { points, order })
        : t("ledgerRedeem", { points });
    case "restore":
      return t("ledgerRestore", { points });
    case "clawback":
      return t("ledgerClawback", { points });
    case "referral":
      return t("ledgerReferral", { points });
    case "adjust":
      return row.points > 0 ? t("ledgerAdded", { points }) : t("ledgerRemoved", { points });
    default:
      return t("ledgerEarn", { points });
  }
}

export function ledgerEntries(
  rows: LedgerRow[],
  t: Translate,
  locale: AccountLocale
): HistoryEntry[] {
  const n = formatNumber(locale);
  const date = formatShortDate(locale);
  return rows.map((row) => ({
    id: row.id,
    label: ledgerHeadline(row, t, n),
    date: date(row.createdAt),
    points: `${row.points > 0 ? "+" : "−"}${n(Math.abs(row.points))}`,
    positive: row.points > 0,
  }));
}
