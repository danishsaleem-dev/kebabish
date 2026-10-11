import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import type { NewFeedback } from "@/lib/feedback/data";

/**
 * "A customer was unhappy" — sent to the kitchen/owner address the moment
 * feedback comes in with a low recommend score.
 *
 * A bad experience is only cheap to fix while it is fresh: a customer who gets a
 * call that evening is often won back, and one who hears nothing tells their
 * neighbours. So this does not wait for anyone to open the admin screen. It goes
 * to the same address as the new-order alert, and says plainly who to contact
 * and how — but only when the customer ticked "you may contact me", otherwise it
 * says so rather than quietly using details they did not offer.
 *
 * Same contract as the other senders: never throws, never blocks the request
 * that triggers it, no-ops without a Resend key.
 */

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function sendLowFeedbackEmail(feedback: NewFeedback): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const to = process.env.ORDER_NOTIFICATION_EMAIL || siteConfig.contact.email;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping low-feedback alert.");
    return;
  }

  const adminUrl = `${siteConfig.website}/admin/feedback`;
  const order = feedback.orderReference ? `order ${feedback.orderReference}` : "no order linked";
  const contact =
    feedback.contactOk && feedback.contactEmail
      ? `${escapeHtml(feedback.contactName ?? "")} &lt;${escapeHtml(feedback.contactEmail)}&gt;`
      : "They did <strong>not</strong> ask to be contacted.";
  const dishes = feedback.dishes.map((d) => escapeHtml(d.name)).join(", ") || "—";

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ede6d0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ede6d0;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#b42318;padding:20px 28px;">
            <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#ffffff;">Unhappy customer — follow up</p>
          </td></tr>
          <tr><td style="padding:24px 28px 8px;">
            <p style="margin:0;font-size:15px;line-height:1.6;color:#1a1713;">
              Would recommend Kebabish: <strong>${feedback.recommend ?? "?"} / 5</strong><br/>
              ${escapeHtml(order)} · dishes: ${dishes}
            </p>
            ${
              feedback.comment
                ? `<p style="margin:14px 0 0;padding:12px 14px;background:#f4efe1;border-radius:10px;font-size:14px;line-height:1.6;color:#1a1713;">“${escapeHtml(feedback.comment)}”</p>`
                : ""
            }
            <p style="margin:14px 0 0;font-size:13px;line-height:1.6;color:#1a1713;">Contact: ${contact}</p>
          </td></tr>
          <tr><td style="padding:16px 28px 28px;" align="center">
            <a href="${adminUrl}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">Open feedback</a>
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
      subject: `Unhappy customer (${feedback.recommend ?? "?"}/5) — ${feedback.orderReference ?? "general feedback"}`,
      html,
    });
    if (error) {
      console.error("[email] Resend rejected the low-feedback alert:", `${error.name}: ${error.message}`);
    }
  } catch (error) {
    console.error("[email] Failed to send the low-feedback alert:", error);
  }
}
