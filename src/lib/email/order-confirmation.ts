import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import { fromCents, vatIncludedCents } from "@/lib/money";
import { getPublicSettings } from "@/lib/admin/store";
import { orderAccessToken } from "@/lib/order-token";
import { getInvoiceNumber, localizeLineNames, type OrderSummary } from "@/lib/orders";
import { loadInvoiceData } from "@/lib/invoice/data";
import { buildInvoicePdf } from "@/lib/invoice/pdf";

/**
 * The customer's copy of a paid order. Sent from the same single place as
 * the kitchen alert (the first transition to paid), so it can't go out for
 * an order that wasn't actually paid.
 *
 * Table layout and inline styles for the same reason as new-order.ts —
 * that's what renders consistently across mail clients.
 */

type Locale = "nl" | "en";

const COPY = {
  nl: {
    subject: (ref: string) => `Bevestiging van je bestelling ${ref}`,
    eyebrow: "Bedankt voor je bestelling",
    intro: (name: string) =>
      `Hoi ${name}, we hebben je betaling ontvangen en gaan aan de slag met je bestelling.`,
    delivery: "Bezorging",
    deliveryWindow: (day: string, start: string, end: string) =>
      `${day}, tussen ${start} en ${end}`,
    address: "Bezorgadres",
    notes: "Je opmerking",
    invoice: "Factuurnummer",
    subtotal: "Subtotaal",
    discount: "Korting",
    fee: "Bezorgkosten",
    free: "Gratis",
    total: "Totaal",
    vat: (rate: number) => `Waarvan btw (${rate}%)`,
    view: "Bekijk je bestelling",
    changes:
      "Iets aanpassen of annuleren? Neem zo snel mogelijk contact met ons op via WhatsApp of telefoon.",
    noCoolingOff:
      "Voor vers bereide en snel bederfelijke levensmiddelen geldt geen wettelijke bedenktijd van 14 dagen.",
    kvk: "KVK",
    vatId: "BTW-id",
    terms: "Algemene voorwaarden",
    privacy: "Privacybeleid",
    dateLocale: "nl-NL",
  },
  en: {
    subject: (ref: string) => `Your order confirmation ${ref}`,
    eyebrow: "Thank you for your order",
    intro: (name: string) =>
      `Hi ${name}, we have received your payment and are getting started on your order.`,
    delivery: "Delivery",
    deliveryWindow: (day: string, start: string, end: string) =>
      `${day}, between ${start} and ${end}`,
    address: "Delivery address",
    notes: "Your note",
    invoice: "Invoice number",
    subtotal: "Subtotal",
    discount: "Discount",
    fee: "Delivery fee",
    free: "Free",
    total: "Total",
    vat: (rate: number) => `Of which VAT (${rate}%)`,
    view: "View your order",
    changes:
      "Need to change or cancel something? Please contact us as soon as possible by WhatsApp or phone.",
    noCoolingOff:
      "The statutory 14-day cooling-off period does not apply to freshly prepared and perishable food.",
    kvk: "KVK",
    vatId: "VAT ID",
    terms: "Terms & conditions",
    privacy: "Privacy policy",
    dateLocale: "en-GB",
  },
} as const;

const money = (cents: number) => `€ ${fromCents(cents).toFixed(2)}`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** "YYYY-MM-DD" -> a weekday label without a UTC parse shifting the day. */
function dayLabel(dateKey: string, dateLocale: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Intl.DateTimeFormat(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(new Date(y, m - 1, d));
}

function html(
  order: OrderSummary,
  locale: Locale,
  vatRate: number | null,
  vatNumber: string | undefined,
  invoiceNumber: string | null
): string {
  const c = COPY[locale];
  const logoUrl = `${siteConfig.website}/logo/Kebabish-light.png`;
  const prefix = locale === "nl" ? "" : "/en";
  const orderUrl = `${siteConfig.website}${prefix}/checkout/complete?ref=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}`;

  const rows = order.lines
    .map((line) => {
      const extras = line.options.map((o) => o.optionLabel).join(", ");
      const suffix = [extras, line.instructions].filter(Boolean).join(" — ");
      return `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#1a1713;">
            <strong>${line.quantity}×</strong> ${escapeHtml(line.name)}
            ${suffix ? `<div style="font-size:12px;color:#6b6459;margin-top:2px;">${escapeHtml(suffix)}</div>` : ""}
          </td>
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#1a1713;text-align:right;white-space:nowrap;">${money(line.lineTotalCents)}</td>
        </tr>`;
    })
    .join("");

  const sumRow = (label: string, value: string, strong = false) => `
    <tr>
      <td style="padding-top:6px;font-size:${strong ? 15 : 13}px;${strong ? "font-weight:bold;" : ""}color:${strong ? "#1a1713" : "#6b6459"};">${label}</td>
      <td style="padding-top:6px;font-size:${strong ? 15 : 13}px;${strong ? "font-weight:bold;" : ""}color:${strong ? "#1a1713" : "#6b6459"};text-align:right;">${value}</td>
    </tr>`;

  const window =
    order.deliveryDate && order.deliverySlotStart && order.deliverySlotEnd
      ? c.deliveryWindow(
          dayLabel(order.deliveryDate, c.dateLocale),
          order.deliverySlotStart,
          order.deliverySlotEnd
        )
      : null;

  const identity = `${siteConfig.brandName} · ${siteConfig.address.street}, ${siteConfig.address.postalCode} ${siteConfig.address.city} · ${c.kvk} ${siteConfig.kvkNumber}${vatNumber ? ` · ${c.vatId} ${vatNumber}` : ""}`;

  return `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ede6d0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ede6d0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#3d3831;padding:24px 28px;">
                <img src="${logoUrl}" alt="Kebabish" height="40" style="display:block;height:40px;width:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#a95026;">${c.eyebrow}</p>
                <h1 style="margin:6px 0 0;font-size:22px;color:#1a1713;">${escapeHtml(order.reference)}</h1>
                ${invoiceNumber ? `<p style="margin:4px 0 0;font-size:12px;color:#6b6459;">${c.invoice} ${escapeHtml(invoiceNumber)}</p>` : ""}
                <p style="margin:10px 0 0;font-size:14px;line-height:1.5;color:#1a1713;">${escapeHtml(c.intro(order.customerName))}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${rows}</table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:6px;">
                  ${sumRow(c.subtotal, money(order.subtotalCents))}
                  ${order.discountCents > 0 ? sumRow(c.discount, `−${money(order.discountCents)}`) : ""}
                  ${sumRow(c.fee, order.deliveryFeeCents === 0 ? c.free : money(order.deliveryFeeCents))}
                  ${sumRow(c.total, money(order.totalCents), true)}
                  ${vatRate != null ? sumRow(c.vat(vatRate), money(vatIncludedCents(order.totalCents, vatRate))) : ""}
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe1;border-radius:10px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#1a1713;line-height:1.6;">
                      ${window ? `<strong>${c.delivery}</strong><br/>${escapeHtml(window)}<br/><br/>` : ""}
                      <strong>${c.address}</strong><br/>
                      ${escapeHtml(order.addressStreet)}, ${escapeHtml(order.addressPostcode)} ${escapeHtml(order.addressCity)}
                      ${order.notes ? `<br/><br/><strong>${c.notes}</strong><br/>${escapeHtml(order.notes)}` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:22px 28px 0;" align="center">
                <a href="${orderUrl}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${c.view}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px;font-size:12px;line-height:1.6;color:#6b6459;">
                <p style="margin:0 0 8px;">${c.changes}</p>
                <p style="margin:0 0 8px;">${c.noCoolingOff}</p>
                <p style="margin:0;">WhatsApp / ${siteConfig.contact.phone} · ${siteConfig.contact.email}</p>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8a8378;">
            <a href="${siteConfig.website}${prefix}/terms" style="color:#8a8378;">${c.terms}</a> ·
            <a href="${siteConfig.website}${prefix}/privacy" style="color:#8a8378;">${c.privacy}</a>
          </p>
          <p style="margin:6px 0 0;font-size:11px;color:#8a8378;">${escapeHtml(identity)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

/**
 * Same contract as sendNewOrderEmail: never throws, never blocks the
 * payment reconciliation that triggers it, no-ops without a Resend key.
 */
export async function sendOrderConfirmationEmail(
  order: OrderSummary,
  locale: string | undefined
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping order confirmation.");
    return;
  }
  if (!order.customerEmail) return;

  const lang: Locale = locale === "en" ? "en" : "nl";

  try {
    const settings = await getPublicSettings();
    const invoiceNumber = await getInvoiceNumber(order.reference);
    const localized = { ...order, lines: await localizeLineNames(order.lines, lang) };
    // The invoice rides along as a PDF — the "durable medium" copy. If making
    // it fails for any reason the confirmation still goes out without it; the
    // customer can download it from their order page.
    let attachments: { filename: string; content: Buffer }[] = [];
    try {
      const invoice = await loadInvoiceData(order.reference);
      if (invoice) {
        attachments = [
          { filename: `${invoice.invoiceNumber}.pdf`, content: Buffer.from(await buildInvoicePdf(invoice)) },
        ];
      }
    } catch (invoiceError) {
      console.error("[email] could not attach the invoice PDF:", invoiceError);
    }

    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to: order.customerEmail,
      attachments,
      subject: COPY[lang].subject(order.reference),
      html: html(
        localized,
        lang,
        settings.vatRatePercent ?? null,
        settings.vatNumber || undefined,
        invoiceNumber
      ),
    });
    if (error) {
      console.error(
        `[email] Resend rejected the confirmation for ${order.reference}:`,
        `${error.name}: ${error.message}`
      );
    }
  } catch (error) {
    console.error("[email] Failed to send order confirmation:", error);
  }
}
