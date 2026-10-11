import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import { RESET_TOKEN_MINUTES } from "@/lib/password-reset";

/**
 * The reset-link email. Written in Dutch and English together: the sign-in
 * pages are not language-aware (they sit outside the /nl /en routing) and
 * nothing is stored about which language an account prefers, so both
 * languages go in one message rather than guessing.
 *
 * Same contract as the other senders — never throws, no-ops without a key.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendPasswordResetEmail(input: {
  to: string;
  name: string;
  resetUrl: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping password reset email.");
    return;
  }

  const logoUrl = `${siteConfig.website}/logo/Kebabish-light.png`;
  const button = (label: string) =>
    `<a href="${input.resetUrl}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${label}</a>`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#ede6d0;font-family:Arial,Helvetica,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ede6d0;padding:24px 12px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#3d3831;padding:24px 28px;">
            <img src="${logoUrl}" alt="Kebabish" height="40" style="display:block;height:40px;width:auto;" />
          </td></tr>
          <tr><td style="padding:28px 28px 8px;">
            <h1 style="margin:0;font-size:20px;color:#1a1713;">Wachtwoord opnieuw instellen</h1>
            <p style="margin:12px 0 18px;font-size:14px;line-height:1.6;color:#1a1713;">
              Hoi ${escapeHtml(input.name)}, we kregen een verzoek om je wachtwoord te wijzigen.
              De link hieronder werkt ${RESET_TOKEN_MINUTES} minuten en maar één keer.
            </p>
            ${button("Nieuw wachtwoord kiezen")}
          </td></tr>
          <tr><td style="padding:26px 28px 0;">
            <h2 style="margin:0;font-size:17px;color:#1a1713;">Reset your password</h2>
            <p style="margin:10px 0 18px;font-size:14px;line-height:1.6;color:#1a1713;">
              Hi ${escapeHtml(input.name)}, we received a request to change your password.
              The link below works for ${RESET_TOKEN_MINUTES} minutes and only once.
            </p>
            ${button("Choose a new password")}
          </td></tr>
          <tr><td style="padding:24px 28px 28px;font-size:12px;line-height:1.6;color:#6b6459;">
            Niet aangevraagd? Dan kun je deze e-mail negeren — je wachtwoord blijft zoals het was.<br/>
            Didn't ask for this? You can ignore this email — your password stays as it is.
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:11px;color:#8a8378;">${escapeHtml(siteConfig.brandName)} · ${escapeHtml(siteConfig.address.city)}</p>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to: input.to,
      subject: "Wachtwoord opnieuw instellen / Reset your password",
      html,
    });
    if (error) {
      console.error(
        "[email] Resend rejected the password reset email:",
        `${error.name}: ${error.message}`
      );
    }
  } catch (error) {
    console.error("[email] Failed to send password reset email:", error);
  }
}
