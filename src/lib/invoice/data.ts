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
    .select("payment_status, payment_method, paid_at, refunded_cents, refunded_at")
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
    refundedCents: extra.refunded_cents ?? 0,
    refundedAt: extra.refunded_at ? new Date(extra.refunded_at) : null,
    delivery: {
      date: order.deliveryDate,
      slotStart: order.deliverySlotStart,
      slotEnd: order.deliverySlotEnd,
    },
  };
}
