import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { getPublicSettings } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";
import { vatIncludedCents } from "@/lib/money";
import {
  getInvoiceNumber,
  getOrderByReference,
  localizeLineNames,
} from "@/lib/orders";
import type { InvoiceData } from "@/lib/invoice/pdf";

/**
 * Everything an invoice needs, gathered from one order — or null when there is
 * nothing to invoice (no such order, or it was never paid). The same data feeds
 * the customer's download, the email attachment and the admin's copy, so they
 * can never disagree.
 */
export async function loadInvoiceData(reference: string): Promise<InvoiceData | null> {
  const order = await getOrderByReference(reference);
  if (!order) return null;

  const { data: extra, error } = await supabaseAdmin()
    .from("orders")
    .select("payment_status, payment_method, paid_at")
    .eq("reference", reference)
    .maybeSingle();
  if (error || !extra) return null;
  // An invoice exists for an order that was paid (even if refunded later).
  if (extra.payment_status !== "paid" && extra.payment_status !== "refunded") return null;

  const invoiceNumber = await getInvoiceNumber(reference);
  if (!invoiceNumber) return null;

  const settings = await getPublicSettings();
  const locale = order.locale === "en" ? "en" : "nl";
  const lines = await localizeLineNames(order.lines, locale);
  const vatRate = settings.vatRatePercent ?? null;

  return {
    locale,
    invoiceNumber,
    invoiceDate: new Date(extra.paid_at ?? order.placedAt),
    reference: order.reference,
    seller: {
      legalName: settings.showLegalNameOnInvoice ? siteConfig.companyName : null,
      tradeName: siteConfig.brandName,
      addressLines: [
        siteConfig.address.street,
        `${siteConfig.address.postalCode} ${siteConfig.address.city}`,
      ],
      kvk: siteConfig.kvkNumber,
      vatId: settings.vatNumber || null,
      email: siteConfig.contact.email,
      phone: siteConfig.contact.phone,
      iban: siteConfig.bank.iban,
      bic: siteConfig.bank.bic,
    },
    customer: {
      name: order.customerName,
      addressLines: [
        order.addressStreet ?? "",
        `${order.addressPostcode ?? ""} ${order.addressCity ?? ""}`.trim(),
      ].filter(Boolean),
      email: order.customerEmail,
      phone: order.customerPhone,
    },
    lines: lines.map((l) => ({
      name: l.name,
      quantity: l.quantity,
      unitCents: Math.round(l.lineTotalCents / Math.max(l.quantity, 1)),
      totalCents: l.lineTotalCents,
      details: [
        ...(l.options.length > 0 ? [l.options.map((o) => o.optionLabel).join(", ")] : []),
        ...(l.instructions ? [`“${l.instructions}”`] : []),
      ],
    })),
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    promoCode: order.promoCode,
    deliveryFeeCents: order.deliveryFeeCents,
    totalCents: order.totalCents,
    vatRate,
    vatCents: vatRate != null ? vatIncludedCents(order.totalCents, vatRate) : null,
    paymentMethod: extra.payment_method ?? "mollie",
    paidAt: extra.paid_at ? new Date(extra.paid_at) : null,
    delivery: {
      date: order.deliveryDate,
      slotStart: order.deliverySlotStart,
      slotEnd: order.deliverySlotEnd,
    },
  };
}

/**
 * A credit note for one refund, as the same document structure: a single
 * negative line, a negative total and the VAT that was inside that refund
 * (frozen when the refund was made). Null if the refund isn't on that order.
 * Carries only what the customer may see — never the internal note.
 */
export async function loadCreditNoteData(
  reference: string,
  creditNoteNumber: string
): Promise<InvoiceData | null> {
  const invoice = await loadInvoiceData(reference);
  if (!invoice) return null;

  const { data: order } = await supabaseAdmin()
    .from("orders")
    .select("id, payment_method")
    .eq("reference", reference)
    .maybeSingle();
  if (!order) return null;

  const { data: refund } = await supabaseAdmin()
    .from("order_refunds")
    .select("amount_cents, mollie_refund_id, reason_customer, vat_rate, vat_cents, created_at")
    .eq("order_id", order.id)
    .eq("credit_note_number", creditNoteNumber)
    .maybeSingle();
  if (!refund) return null;

  const amount = refund.amount_cents as number;
  const description =
    invoice.locale === "en"
      ? `Refund for order ${invoice.reference}`
      : `Terugbetaling voor bestelling ${invoice.reference}`;

  return {
    ...invoice,
    invoiceDate: new Date(refund.created_at),
    lines: [
      {
        name: description,
        quantity: 1,
        unitCents: -amount,
        totalCents: -amount,
        details: [],
      },
    ],
    subtotalCents: -amount,
    discountCents: 0,
    promoCode: null,
    deliveryFeeCents: 0,
    totalCents: -amount,
    vatRate: refund.vat_rate != null ? Number(refund.vat_rate) : null,
    vatCents: refund.vat_cents != null ? -(refund.vat_cents as number) : null,
    paidAt: null,
    delivery: { date: null, slotStart: null, slotEnd: null },
    creditNote: {
      number: creditNoteNumber,
      invoiceNumber: invoice.invoiceNumber,
      reason: refund.reason_customer ?? null,
      viaMollie: Boolean(refund.mollie_refund_id),
    },
  };
}
