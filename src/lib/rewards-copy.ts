import { fromCents } from "@/lib/money";
import { progressToReward, type RewardsConfig } from "@/lib/rewards-math";

/**
 * The short points lines inside customer emails, in the customer's language. Pure, so every
 * sentence can be checked without sending anything. These emails go out whatever the customer's
 * marketing choice is: they say what happened to their own points, they don't sell anything.
 */

type Locale = "nl" | "en";

const num = (n: number, locale: Locale) => n.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");
const euro = (cents: number) => `€ ${fromCents(cents).toFixed(2)}`;

/** Where the balance stands, and what it can do. */
function balanceLine(balance: number, config: RewardsConfig, locale: Locale): string {
  const progress = progressToReward(balance, config);
  const amount = euro(config.redeemStepCents);
  if (locale === "nl") {
    return progress.canRedeem
      ? `Je hebt nu ${num(balance, locale)} punten. Je kunt ze bij je volgende bestelling inwisselen voor korting.`
      : `Je hebt nu ${num(balance, locale)} punten. Nog ${num(progress.toGo, locale)} punten tot ${amount} korting.`;
  }
  return progress.canRedeem
    ? `You now have ${num(balance, locale)} points. You can use them for money off your next order.`
    : `You now have ${num(balance, locale)} points. ${num(progress.toGo, locale)} more for ${amount} off.`;
}

/** Order confirmation: what was spent, and what is coming. */
export function confirmationNote(input: {
  used: number;
  expected: number;
  welcome: number;
  locale: Locale;
}): string | null {
  const { used, expected, welcome, locale } = input;
  const parts: string[] = [];
  if (locale === "nl") {
    if (used > 0) parts.push(`Je hebt ${num(used, locale)} punten gebruikt voor deze bestelling.`);
    if (expected > 0) parts.push(`Zodra hij is bezorgd, krijg je ${num(expected, locale)} punten.`);
    if (welcome > 0) parts.push(`Je krijgt er ook ${num(welcome, locale)} welkomstpunten bij.`);
  } else {
    if (used > 0) parts.push(`You used ${num(used, locale)} points on this order.`);
    if (expected > 0) parts.push(`You'll get ${num(expected, locale)} points once it's delivered.`);
    if (welcome > 0) parts.push(`You'll also get ${num(welcome, locale)} welcome points.`);
  }
  return parts.length > 0 ? parts.join(" ") : null;
}

/** Delivered email. */
export function deliveredNote(input: {
  earned: number;
  welcome: number;
  balance: number;
  config: RewardsConfig;
  locale: Locale;
}): string | null {
  const { earned, welcome, balance, config, locale } = input;
  if (earned <= 0 && welcome <= 0) return null;
  const first =
    locale === "nl"
      ? welcome > 0
        ? `Je hebt ${num(earned + welcome, locale)} punten gekregen, waarvan ${num(welcome, locale)} welkomstpunten.`
        : `Je hebt ${num(earned, locale)} punten gekregen.`
      : welcome > 0
        ? `You got ${num(earned + welcome, locale)} points, including ${num(welcome, locale)} welcome points.`
        : `You got ${num(earned, locale)} points.`;
  return `${first} ${balanceLine(balance, config, locale)}`;
}

/** Cancelled or refunded: points back, points taken back. */
export function reversalNote(input: {
  restored: number;
  removed: number;
  balance: number;
  config: RewardsConfig;
  locale: Locale;
}): string | null {
  const { restored, removed, balance, config, locale } = input;
  if (restored <= 0 && removed <= 0) return null;
  const parts: string[] = [];
  if (locale === "nl") {
    if (restored > 0) parts.push(`De ${num(restored, locale)} punten die je gebruikte, staan weer op je account.`);
    if (removed > 0) parts.push(`${num(removed, locale)} punten van deze bestelling zijn vervallen.`);
  } else {
    if (restored > 0) parts.push(`The ${num(restored, locale)} points you used are back on your account.`);
    if (removed > 0) parts.push(`${num(removed, locale)} points from this order have been removed.`);
  }
  parts.push(balanceLine(balance, config, locale));
  return parts.join(" ");
}

export interface SimpleEmail {
  subject: string;
  title: string;
  body: string;
}

/** A friend's order was delivered. */
export function referralRewardEmail(
  points: number,
  balance: number,
  config: RewardsConfig,
  locale: Locale
): SimpleEmail {
  const line = balanceLine(balance, config, locale);
  return locale === "nl"
    ? {
        subject: `Je hebt ${num(points, locale)} punten gekregen`,
        title: "Bedankt voor het doorgeven!",
        body: `Een vriend heeft zijn eerste bestelling bij Kebabish gehad, dankzij jouw link. Daarom krijg je ${num(points, locale)} punten. ${line}`,
      }
    : {
        subject: `You got ${num(points, locale)} points`,
        title: "Thanks for passing it on!",
        body: `A friend has received their first Kebabish order, thanks to your link. So you get ${num(points, locale)} points. ${line}`,
      };
}

/** Staff added or removed points by hand. */
export function adjustmentEmail(
  points: number,
  reason: string,
  balance: number,
  config: RewardsConfig,
  locale: Locale
): SimpleEmail {
  const size = num(Math.abs(points), locale);
  const line = balanceLine(balance, config, locale);
  if (locale === "nl") {
    return points > 0
      ? {
          subject: `We hebben ${size} punten voor je bijgeschreven`,
          title: "Punten bijgeschreven",
          body: `We hebben ${size} punten op je account gezet. Reden: ${reason}. ${line}`,
        }
      : {
          subject: "Je puntensaldo is aangepast",
          title: "Puntensaldo aangepast",
          body: `We hebben ${size} punten van je account gehaald. Reden: ${reason}. ${line}`,
        };
  }
  return points > 0
    ? {
        subject: `We've added ${size} points for you`,
        title: "Points added",
        body: `We've added ${size} points to your account. Reason: ${reason}. ${line}`,
      }
    : {
        subject: "Your points balance has changed",
        title: "Points balance changed",
        body: `We've removed ${size} points from your account. Reason: ${reason}. ${line}`,
      };
}
