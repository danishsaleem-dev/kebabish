import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";

/**
 * "A dish is running low / has run out" — sent to the kitchen/owner address at the moment an
 * order takes a dish across its warning level or down to nothing (see lib/stock.ts), so there
 * is still time to cook another batch. Same contract as the other senders: never throws, never
 * blocks the order that triggered it, no-ops without a Resend key.
 */

export interface StockAlert {
  slug: string;
  name: string;
  level: "low" | "out";
  /** What is left (0 for out). The owner sees the number; customers never do. */
  quantity: number;
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sendStockAlertEmail(alerts: StockAlert[]): Promise<void> {
  if (alerts.length === 0) return;
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFICATION_EMAIL || siteConfig.contact.email;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping stock alert.");
    return;
  }

  const anyOut = alerts.some((a) => a.level === "out");
  const rows = alerts
    .map((a) =>
      a.level === "out"
        ? `<p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#1a1713;"><strong style="color:#b3261e;">Out of stock</strong> — ${escapeHtml(a.name)}<br/><span style="font-size:13px;color:#6b645a;">It now shows as sold out on the website, and customers can request it.</span></p>`
        : `<p style="margin:0 0 10px;font-size:15px;line-height:1.5;color:#1a1713;"><strong style="color:#a95026;">Running low</strong> — ${escapeHtml(a.name)}: <strong>${a.quantity}</strong> left<br/><span style="font-size:13px;color:#6b645a;">Customers see “selling fast” (never the number).</span></p>`
    )
    .join("");

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ede6d0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ede6d0;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:${anyOut ? "#b3261e" : "#a95026"};padding:20px 28px;">
            <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;">${anyOut ? "Out of stock" : "Stock is running low"}</p>
          </td></tr>
          <tr><td style="padding:24px 28px 8px;">${rows}</td></tr>
          <tr><td style="padding:16px 28px 28px;" align="center">
            <a href="${siteConfig.website}/admin/menu" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">Open the menu to add a batch</a>
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  const subject =
    alerts.length === 1
      ? alerts[0].level === "out"
        ? `Out of stock: ${alerts[0].name}`
        : `Running low: ${alerts[0].name} (${alerts[0].quantity} left)`
      : `Stock alert: ${alerts.length} dishes`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to,
      subject,
      html,
    });
    if (error) console.error("[email] Resend rejected the stock alert:", `${error.name}: ${error.message}`);
  } catch (error) {
    console.error("[email] Failed to send the stock alert:", error);
  }
}
