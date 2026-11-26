import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import { formatEuro, fromCents } from "@/lib/money";
import type { OrderSummary } from "@/lib/orders";

/**
 * "You can still pay": sent when staff reopen an unpaid order. Dutch or English, like the
 * other order emails. Never throws; returns whether it went out, so staff know whether to
 * send the link themselves.
 */
export async function sendPaymentReopenedEmail(
  order: OrderSummary,
  details: { url: string; openUntil: string }
): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !order.customerEmail) return false;

  const nl = order.locale !== "en";
  const dutchOrEnglish = nl ? "nl-NL" : "en-GB";
  const amount = formatEuro(fromCents(order.totalCents));
  const until = new Date(details.openUntil).toLocaleString(dutchOrEnglish, {
    timeZone: "Europe/Amsterdam",
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  });
  const when =
    order.deliveryDate && order.deliverySlotStart && order.deliverySlotEnd
      ? `${new Date(`${order.deliveryDate}T12:00:00Z`).toLocaleDateString(dutchOrEnglish, {
          timeZone: "UTC",
          weekday: "long",
          day: "numeric",
          month: "long",
        })}, ${order.deliverySlotStart}–${order.deliverySlotEnd}`
      : null;

  const c = nl
    ? {
        subject: `Betaal je bestelling ${order.reference}`,
        title: "Je kunt nog betalen",
        hi: `Hoi ${order.customerName},`,
        body: `We hebben de betaling voor je bestelling opnieuw opengezet. Zodra je ${amount} hebt betaald, gaan we ermee aan de slag.`,
        delivery: "Bezorging",
        valid: `Betalen kan tot ${until}.`,
        button: `Betaal ${amount}`,
      }
    : {
        subject: `Pay for your order ${order.reference}`,
        title: "You can still pay",
        hi: `Hi ${order.customerName},`,
        body: `We have reopened the payment for your order. As soon as you have paid ${amount}, we will get started on it.`,
        delivery: "Delivery",
        valid: `You can pay until ${until}.`,
        button: `Pay ${amount}`,
      };

  const e = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const p = "margin:14px 0 0;font-size:14px;line-height:1.6;color:#1a1713;";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px 12px;background:#ede6d0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" align="center" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;">
      <tr><td style="background:#3d3831;padding:24px 28px;">
        <img src="${siteConfig.website}/logo/Kebabish-light.png" alt="Kebabish" height="40" style="display:block;height:40px;width:auto;" />
      </td></tr>
      <tr><td style="padding:28px 28px 0;">
        <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#a95026;">${e(order.reference)}</p>
        <h1 style="margin:6px 0 0;font-size:22px;color:#1a1713;">${e(c.title)}</h1>
        <p style="${p}">${e(c.hi)}<br/>${e(c.body)}</p>
        ${when ? `<p style="${p}"><strong>${c.delivery}:</strong> ${e(when)}</p>` : ""}
        <p style="${p}">${e(c.valid)}</p>
      </td></tr>
      <tr><td align="center" style="padding:20px 28px 0;">
        <a href="${e(details.url)}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${e(c.button)}</a>
      </td></tr>
      <tr><td style="padding:20px 28px 28px;font-size:12px;line-height:1.6;color:#6b6459;">
        WhatsApp / ${siteConfig.contact.phone} · ${siteConfig.contact.email}
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to: order.customerEmail,
      subject: c.subject,
      html,
    });
    if (error) {
      console.error(`[email] Resend rejected the payment link for ${order.reference}: ${error.message}`);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] Failed to send the payment link:", error);
    return false;
  }
}
