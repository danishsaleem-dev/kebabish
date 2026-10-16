import "server-only";
import { Resend } from "resend";
import { siteConfig } from "@/lib/site-config";
import { fromCents } from "@/lib/money";
import { orderAccessToken } from "@/lib/order-token";
import type { OrderSummary } from "@/lib/orders";

/**
 * The short "where is my order" emails: accepted, on the way, delivered,
 * cancelled, refunded. The long one with the full receipt is
 * order-confirmation.ts — these are deliberately brief and link back to the
 * order page instead of repeating everything.
 *
 * Same contract as the other senders: never throws, never blocks the action
 * that triggers it, no-ops without a Resend key.
 */

export type OrderStatusEmailKind =
  | "scheduled"
  | "preparing"
  | "on_the_way"
  | "delivered"
  | "cancelled"
  | "refunded";

type Locale = "nl" | "en";

const money = (cents: number) => `€ ${fromCents(cents).toFixed(2)}`;

interface Copy {
  subject: string;
  title: string;
  body: string;
}

function copy(
  kind: OrderStatusEmailKind,
  locale: Locale,
  order: OrderSummary,
  refundedCents: number
): Copy {
  const ref = order.reference;
  const slot =
    order.deliverySlotStart && order.deliverySlotEnd
      ? `${order.deliverySlotStart}–${order.deliverySlotEnd}`
      : null;
  // "zaterdag 18 oktober, 18:00–18:45" — for an order accepted for a later day.
  const when = order.deliveryDate
    ? `${new Date(`${order.deliveryDate}T12:00:00`).toLocaleDateString(locale === "nl" ? "nl-NL" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })}${slot ? `, ${slot}` : ""}`
    : slot;

  if (locale === "nl") {
    switch (kind) {
      case "scheduled":
        return {
          subject: `Je bestelling ${ref} is bevestigd`,
          title: "Bevestigd voor later",
          body: `Goed nieuws: we hebben je bestelling geaccepteerd.${when ? ` Bezorging: ${when}.` : ""} We beginnen pas op de dag zelf met koken, zodat alles vers bij je aankomt.`,
        };
      case "preparing":
        return {
          subject: `We bereiden je bestelling ${ref}`,
          title: "We zijn begonnen",
          body: `Goed nieuws: onze keuken heeft je bestelling geaccepteerd en is aan de slag.${slot ? ` Verwachte bezorging: ${slot}.` : ""}`,
        };
      case "on_the_way":
        return {
          subject: `Je bestelling ${ref} is onderweg`,
          title: "Onderweg naar jou",
          body: "Je bestelling is onderweg. Zorg dat je telefoon bij de hand is voor de bezorger.",
        };
      case "delivered":
        return {
          subject: `Je bestelling ${ref} is bezorgd`,
          title: "Eet smakelijk!",
          body: "Je bestelling is bezorgd. We hopen dat je ervan geniet. Hoe was het? Vertel het ons in twee minuten \u2014 en iets niet in orde? Laat het ons weten via WhatsApp of e-mail.",
        };
      case "cancelled":
        return {
          subject: `Je bestelling ${ref} is geannuleerd`,
          title: "Bestelling geannuleerd",
          body:
            refundedCents > 0
              ? `Helaas hebben we je bestelling moeten annuleren. Je betaling van ${money(refundedCents)} wordt teruggestort op de rekening waarmee je hebt betaald; dat kan enkele werkdagen duren.`
              : "Helaas hebben we je bestelling moeten annuleren. Neem contact met ons op als je hier vragen over hebt.",
        };
      case "refunded":
        return {
          subject: `Terugbetaling voor je bestelling ${ref}`,
          title: "Je geld komt terug",
          body: `We hebben ${money(refundedCents)} teruggestort op de rekening waarmee je hebt betaald. Dat kan enkele werkdagen duren.`,
        };
    }
  }

  switch (kind) {
    case "scheduled":
      return {
        subject: `Your order ${ref} is confirmed`,
        title: "Confirmed for later",
        body: `Good news: we have accepted your order.${when ? ` Delivery: ${when}.` : ""} We only start cooking on the day itself, so everything reaches you fresh.`,
      };
    case "preparing":
      return {
        subject: `We are preparing your order ${ref}`,
        title: "We have started",
        body: `Good news: our kitchen has accepted your order and is getting started.${slot ? ` Expected delivery: ${slot}.` : ""}`,
      };
    case "on_the_way":
      return {
        subject: `Your order ${ref} is on its way`,
        title: "On its way to you",
        body: "Your order is on its way. Keep your phone handy for the courier.",
      };
    case "delivered":
      return {
        subject: `Your order ${ref} has been delivered`,
        title: "Enjoy your meal!",
        body: "Your order has been delivered. We hope you enjoy it. How was it? Tell us in two minutes \u2014 and if anything isn't right, let us know by WhatsApp or email.",
      };
    case "cancelled":
      return {
        subject: `Your order ${ref} has been cancelled`,
        title: "Order cancelled",
        body:
          refundedCents > 0
            ? `Unfortunately we had to cancel your order. Your payment of ${money(refundedCents)} is being refunded to the account you paid with; this can take a few working days.`
            : "Unfortunately we had to cancel your order. Please contact us if you have any questions.",
      };
    case "refunded":
      return {
        subject: `Refund for your order ${ref}`,
        title: "Your money is on its way back",
        body: `We have refunded ${money(refundedCents)} to the account you paid with. This can take a few working days.`,
      };
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface OrderStatusEmailExtra {
  /** Only passed when staff chose to give the customer a reason. */
  reason?: string;
  /** The credit note PDF for a refund. */
  creditNote?: { number: string; pdf: Buffer };
  /** True when part of the money went back, not all of it. */
  partial?: boolean;
}

function html(
  order: OrderSummary,
  locale: Locale,
  c: Copy,
  extra?: OrderStatusEmailExtra,
  wantsFeedback = false
): string {
  const logoUrl = `${siteConfig.website}/logo/Kebabish-light.png`;
  const prefix = locale === "nl" ? "" : "/en";
  const orderUrl = `${siteConfig.website}${prefix}/checkout/complete?ref=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}`;
  const view = locale === "nl" ? "Bekijk je bestelling" : "View your order";
  // After delivery the main thing to do is say how it went; the order page is
  // the quieter second link. The same signed token as the order page vouches
  // for the order, so the form needs no login.
  const feedbackUrl = `${siteConfig.website}${prefix}/feedback?order=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}&src=email`;
  const feedbackLabel = locale === "nl" ? "Geef je feedback" : "Give your feedback";
  const hi = locale === "nl" ? `Hoi ${order.customerName},` : `Hi ${order.customerName},`;
  const reasonLine = extra?.reason
    ? `<p style="margin:12px 0 0;font-size:14px;line-height:1.6;color:#1a1713;"><strong>${locale === "nl" ? "Reden" : "Reason"}:</strong> ${escapeHtml(extra.reason)}</p>`
    : "";
  const creditLine = extra?.creditNote
    ? `<p style="margin:12px 0 0;font-size:13px;line-height:1.6;color:#6b6459;">${
        locale === "nl"
          ? `De creditnota (${escapeHtml(extra.creditNote.number)}) vind je in de bijlage.`
          : `Your credit note (${escapeHtml(extra.creditNote.number)}) is attached.`
      }</p>`
    : "";

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
                <p style="margin:0;font-size:12px;font-weight:bold;letter-spacing:0.06em;text-transform:uppercase;color:#a95026;">${escapeHtml(order.reference)}</p>
                <h1 style="margin:6px 0 0;font-size:22px;color:#1a1713;">${escapeHtml(c.title)}</h1>
                <p style="margin:14px 0 0;font-size:14px;line-height:1.6;color:#1a1713;">${escapeHtml(hi)}<br/>${escapeHtml(c.body)}</p>
                ${reasonLine}${creditLine}
              </td>
            </tr>
            ${
              wantsFeedback
                ? `<tr>
              <td style="padding:20px 28px 0;" align="center">
                <a href="${feedbackUrl}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${feedbackLabel}</a>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 28px 0;" align="center">
                <a href="${orderUrl}" style="font-size:13px;color:#a95026;text-decoration:underline;">${view}</a>
              </td>
            </tr>`
                : `<tr>
              <td style="padding:20px 28px 0;" align="center">
                <a href="${orderUrl}" style="display:inline-block;background:#a95026;color:#ffffff;text-decoration:none;font-size:14px;font-weight:bold;padding:12px 28px;border-radius:8px;">${view}</a>
              </td>
            </tr>`
            }
            <tr>
              <td style="padding:20px 28px 28px;font-size:12px;line-height:1.6;color:#6b6459;">
                WhatsApp / ${siteConfig.contact.phone} · ${siteConfig.contact.email}
              </td>
            </tr>
          </table>
          <p style="margin:16px 0 0;font-size:11px;color:#8a8378;">${escapeHtml(siteConfig.brandName)} · ${escapeHtml(siteConfig.address.street)}, ${escapeHtml(siteConfig.address.postalCode)} ${escapeHtml(siteConfig.address.city)}</p>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendOrderStatusEmail(
  order: OrderSummary,
  kind: OrderStatusEmailKind,
  /** For cancelled/refunded: how much went back to the customer. */
  refundedCents = 0,
  extra?: OrderStatusEmailExtra
): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[email] RESEND_API_KEY not set — skipping "${kind}" email.`);
    return;
  }
  if (!order.customerEmail) return;

  const locale: Locale = order.locale === "en" ? "en" : "nl";
  const c = copy(kind, locale, order, refundedCents);

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: `${siteConfig.brandName} <${siteConfig.contact.email}>`,
      to: order.customerEmail,
      subject: c.subject,
      html: html(order, locale, c, extra, kind === "delivered"),
      ...(extra?.creditNote
        ? { attachments: [{ filename: `${extra.creditNote.number}.pdf`, content: extra.creditNote.pdf }] }
        : {}),
    });
    if (error) {
      console.error(
        `[email] Resend rejected the "${kind}" email for ${order.reference}:`,
        `${error.name}: ${error.message}`
      );
    }
  } catch (error) {
    console.error(`[email] Failed to send "${kind}" email:`, error);
  }
}
