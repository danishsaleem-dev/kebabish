import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import type { SimpleEmail } from "@/lib/rewards-copy";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * A short message about a customer's own points (a friend's order paid out, staff changed the
 * balance). Same contract as the other senders: never throws, no-ops without a Resend key.
 */
export async function sendRewardsEmail(input: {
  to: string;
  name: string;
  locale: "nl" | "en";
  email: SimpleEmail;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping a rewards email.");
    return;
  }
  if (!input.to) return;

  const { email, locale } = input;
  const hi = locale === "nl" ? `Hoi ${input.name},` : `Hi ${input.name},`;
  const cta = locale === "nl" ? "Bekijk je punten" : "See your points";
  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ede6d0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ede6d0;padding:24px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
            <tr>
              <td style="background:#3d3831;padding:24px 28px;">
                <img src="${siteConfig.website}/logo/Kebabish-light.png" alt="Kebabish" height="40" style="display:block;height:40px;width:auto;" />
              </td>
            </tr>
            <tr>
              <td style="padding:28px 28px 8px;">
                <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#a95026;">Kebabish Punten</p>
                <h1 style="margin:6px 0 0;font-size:22px;color:#1a1713;">${escapeHtml(email.title)}</h1>
                <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#1a1713;">${escapeHtml(hi)}<br/>${escapeHtml(email.body)}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 28px 28px;" align="center">
                <a href="${siteConfig.website}/dashboard" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${cta}</a>
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8a8378;">${escapeHtml(siteConfig.brandName)} · ${escapeHtml(siteConfig.address.street)}, ${escapeHtml(siteConfig.address.postalCode)} ${escapeHtml(siteConfig.address.city)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  try {
    const { error } = await new Resend(apiKey).emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to: input.to,
      subject: email.subject,
      html,
    });
    if (error) console.error("[email] Resend rejected a rewards email:", `${error.name}: ${error.message}`);
  } catch (error) {
    console.error("[email] Failed to send a rewards email:", error);
  }
}
