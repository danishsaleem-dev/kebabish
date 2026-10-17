import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import type { NewStockRequest } from "@/lib/stock-requests/data";

/**
 * "Someone wants a dish that is sold out" — sent to the kitchen/owner address as
 * soon as a request comes in, with who to ring and when they want it. A customer who
 * asked for something is warm only briefly; this does not wait for anyone to open the
 * admin. Same contract as the other senders: never throws, never blocks the request
 * that triggers it, no-ops without a Resend key.
 */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sendStockRequestEmail(request: NewStockRequest): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFICATION_EMAIL || siteConfig.contact.email;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping stock-request alert.");
    return;
  }

  const when = request.wantedDate
    ? `${new Date(`${request.wantedDate}T12:00:00`).toLocaleDateString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}${request.wantedTime ? ` at ${request.wantedTime}` : ""}`
    : "no date given";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ede6d0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ede6d0;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#3d3831;padding:20px 28px;">
            <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;">Dish request — get back to them</p>
          </td></tr>
          <tr><td style="padding:24px 28px 8px;">
            <p style="margin:0;font-size:18px;font-weight:bold;color:#1a1713;">${request.quantity}× ${escapeHtml(request.itemName)}</p>
            <p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#1a1713;">Wanted: <strong>${escapeHtml(when)}</strong></p>
            <p style="margin:14px 0 0;font-size:14px;line-height:1.7;color:#1a1713;">
              ${escapeHtml(request.customerName)}<br/>
              Tel <a href="tel:${escapeHtml(request.phone.replace(/[^\d+]/g, ""))}" style="color:#a95026;">${escapeHtml(request.phone)}</a>${
                request.email ? `<br/>${escapeHtml(request.email)}` : ""
              }
            </p>
            ${
              request.note
                ? `<p style="margin:14px 0 0;padding:12px 14px;background:#f4efe1;border-radius:10px;font-size:14px;line-height:1.6;color:#1a1713;">“${escapeHtml(request.note)}”</p>`
                : ""
            }
          </td></tr>
          <tr><td style="padding:16px 28px 28px;" align="center">
            <a href="${siteConfig.website}/admin/requests" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">Open requests</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to,
      subject: `Request: ${request.quantity}× ${request.itemName} — ${request.customerName}`,
      html,
    });
    if (error) {
      console.error("[email] Resend rejected the stock-request alert:", `${error.name}: ${error.message}`);
    }
  } catch (error) {
    console.error("[email] Failed to send the stock-request alert:", error);
  }
}
