import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import { ACCOUNT_SETUP_DAYS } from "@/lib/customers/account-rules";

/**
 * "Choose your password" on its own — for the dashboard's "send it again" button. (The
 * first copy rides inside the order confirmation, see order-confirmation.ts.) One
 * language, the one the customer ordered in. Same contract as the other senders: never
 * throws, no-ops without a Resend key.
 */

type Locale = "nl" | "en";

const COPY = {
  nl: {
    subject: "Kies je wachtwoord voor je Kebabish-account",
    title: "Bevestig je account",
    text: (name: string) =>
      `Hoi ${name}, je Kebabish-account staat klaar. Kies een wachtwoord om het te bevestigen, dan kun je je bestellingen volgen en opnieuw bestellen. De link werkt ${ACCOUNT_SETUP_DAYS} dagen en maar één keer.`,
    cta: "Wachtwoord kiezen",
    ignore: "Heb je dit niet aangevraagd of wil je geen account? Negeer deze e-mail.",
  },
  en: {
    subject: "Choose your password for your Kebabish account",
    title: "Confirm your account",
    text: (name: string) =>
      `Hi ${name}, your Kebabish account is ready. Choose a password to confirm it, then you can follow your orders and order again. The link works for ${ACCOUNT_SETUP_DAYS} days and only once.`,
    cta: "Choose a password",
    ignore: "Didn't ask for this, or don't want an account? Just ignore this email.",
  },
} as const;

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function sendAccountSetupEmail(input: {
  to: string;
  name: string;
  setupUrl: string;
  locale?: string;
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn("[email] RESEND_API_KEY not set — skipping the account setup email.");
    return;
  }
  const c = COPY[input.locale === "en" ? "en" : "nl"];
  const logoUrl = `${siteConfig.website}/logo/Kebabish-light.png`;

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
            <h1 style="margin:0;font-size:20px;color:#1a1713;">${c.title}</h1>
            <p style="margin:12px 0 18px;font-size:14px;line-height:1.6;color:#1a1713;">${escapeHtml(c.text(input.name))}</p>
            <a href="${input.setupUrl}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${c.cta}</a>
          </td></tr>
          <tr><td style="padding:22px 28px 28px;font-size:12px;line-height:1.6;color:#6b6459;">${c.ignore}</td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to: input.to,
      subject: c.subject,
      html,
    });
    if (error) console.error("[email] Resend rejected the account setup email:", `${error.name}: ${error.message}`);
  } catch (error) {
    console.error("[email] Failed to send the account setup email:", error);
  }
}
