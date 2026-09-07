import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import { fromCents } from "@/lib/money";
import type { OrderSummary } from "@/lib/orders";

/**
 * One-off transactional email — a paid order landed and needs a kitchen
 * decision. Not the same audience or purpose as a marketing send, so this
 * deliberately doesn't reach for a templating library: one function
 * building one inline-styled HTML string, table-based layout throughout
 * because that's still what renders consistently across Outlook/Gmail/
 * Apple Mail — no flexbox/grid, no external stylesheet.
 */

const money = (cents: number) => `€ ${fromCents(cents).toFixed(2)}`;

function newOrderEmailHtml(order: OrderSummary): string {
  const logoUrl = `${siteConfig.website}/logo/Kebabish-light.png`;
  const orderUrl = `https://${new URL(siteConfig.website).hostname.replace(/^www\./, "")}/admin/orders`;
  const address =
    order.fulfilment === "delivery"
      ? `${order.addressStreet}, ${order.addressPostcode} ${order.addressCity}`
      : "Pickup";

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
          <td style="padding:10px 0;border-bottom:1px solid #eee;font-size:14px;color:#1a1713;text-align:right;white-space:nowrap;">
            ${money(line.lineTotalCents)}
          </td>
        </tr>`;
    })
    .join("");

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
                <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#a95026;">
                  New order — needs a decision
                </p>
                <h1 style="margin:6px 0 0;font-size:22px;color:#1a1713;">${order.reference}</h1>
                <p style="margin:4px 0 0;font-size:13px;color:#6b6459;">
                  ${new Date(order.placedAt).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${rows}
                </table>
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;">
                  <tr>
                    <td style="padding-top:10px;font-size:15px;font-weight:bold;color:#1a1713;">Total</td>
                    <td style="padding-top:10px;font-size:15px;font-weight:bold;color:#1a1713;text-align:right;">${money(order.totalCents)}</td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 0;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4efe1;border-radius:10px;">
                  <tr>
                    <td style="padding:14px 16px;font-size:13px;color:#1a1713;line-height:1.5;">
                      <strong>${escapeHtml(order.customerName)}</strong><br/>
                      ${escapeHtml(order.customerPhone)}<br/>
                      ${escapeHtml(address)}
                      ${order.notes ? `<div style="margin-top:6px;color:#a95026;"><strong>Note:</strong> ${escapeHtml(order.notes)}</div>` : ""}
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 28px 28px;" align="center">
                <a href="${orderUrl}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">
                  Open in admin
                </a>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8a8378;">Kebabish · ${siteConfig.address.city}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Fire-and-forget by design (see call site in orders.ts): a slow or failed
 * email must never hold up or fail the payment webhook / return-page
 * reconciliation that triggers it. Silently no-ops without a configured
 * key rather than throwing, so this can ship ahead of Danish setting up
 * Resend — same resilience pattern as `getPublicSettings()`.
 */
export async function sendNewOrderEmail(order: OrderSummary): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFICATION_EMAIL || siteConfig.contact.email;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping new-order email.");
    return;
  }

  try {
    const domain = new URL(siteConfig.website).hostname.replace(/^www\./, "");
    const resend = new Resend(apiKey);
    await resend.emails.send({
      from: `Kebabish <orders@${domain}>`,
      to,
      subject: `New order ${order.reference} — ${money(order.totalCents)}`,
      html: newOrderEmailHtml(order),
    });
  } catch (error) {
    console.error("[email] Failed to send new-order email:", error);
  }
}
