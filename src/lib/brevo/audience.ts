/**
 * Who may be sent a marketing email, and what Brevo is told about them.
 *
 * Pure — no database, no network, no `server-only` — so it can be run by
 * `scripts/check-audience.mts` and reasoned about on its own, the same way
 * `rewards-math.ts`, `supplies.ts` and `stock-status.ts` are.
 *
 * The rule this file exists to enforce, in one sentence: **nobody is ever a
 * marketing contact unless they ticked a box, and anybody Brevo has told us
 * to stop emailing stays stopped.** Consent can only be given in our own app;
 * suppression can only come back from Brevo. Nothing in the admin panel can
 * add somebody to the audience, which is what makes "an administrator must
 * not be able to bypass unsubscribe restrictions" true by construction
 * rather than by vigilance.
 */

/** A registered account, as the audience needs it. Mirrors the `customers` columns. */
export interface AudienceAccount {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  marketingOptIn: boolean;
  /** Set the moment consent is withdrawn; a withdrawn account is never eligible. */
  marketingWithdrawnAt: string | null;
  marketingConsentAt: string | null;
}

/**
 * A guest's consent, which lives on the order rather than on an account —
 * guests have no `customers` row at all (migration 0011's design).
 */
export interface AudienceGuestOrder {
  email: string | null;
  name: string | null;
  phone: string | null;
  marketingOptIn: boolean;
  /** The order's own `created_at` is the consent date, per 0011. */
  placedAt: string;
}

/** The per-person facts the sync sends to Brevo as contact attributes. */
export interface AudienceStats {
  orderCount: number;
  lastOrderAt: string | null;
  /** Integer cents, like all money in this codebase. */
  totalSpentCents: number;
  favouriteDish: string | null;
  /** From the customer's latest order's `locale` — `customers` has no language column. */
  language: "nl" | "en";
  rewardPoints: number | null;
}

export type ContactKind = "registered" | "guest";

export interface MarketingContact {
  /** Lowercased, trimmed — the matching identifier on both sides. */
  email: string;
  /** The `customers.id` for a registered contact, null for a guest. */
  customerId: string | null;
  kind: ContactKind;
  name: string;
  phone: string | null;
  consentAt: string | null;
  stats: AudienceStats;
}

export const DEFAULT_STATS: AudienceStats = {
  orderCount: 0,
  lastOrderAt: null,
  totalSpentCents: 0,
  favouriteDish: null,
  language: "nl",
  rewardPoints: null,
};

/* ------------------------------------------------------------------ email */

/**
 * Deliberately loose. This is not a validator that decides whether somebody
 * may order — the address is already in the database because they used it —
 * it only keeps obvious junk out of a contact import, which Brevo would
 * reject for the whole batch.
 */
export function isSendableEmail(value: string | null | undefined): boolean {
  const email = normalizeEmail(value);
  if (!email) return false;
  if (email.length > 254) return false;
  if (email.includes("..")) return false;
  const at = email.indexOf("@");
  if (at < 1 || at !== email.lastIndexOf("@")) return false;
  const domain = email.slice(at + 1);
  if (!domain.includes(".") || domain.startsWith(".") || domain.endsWith(".")) return false;
  if (/[\s",;<>\\()[\]]/.test(email)) return false;
  return true;
}

/** Lowercased and trimmed, or "" — the single spelling of an address everywhere here. */
export function normalizeEmail(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

/* -------------------------------------------------------------- eligibility */

/** An account has consented when the box is ticked and has not since been unticked. */
export function accountConsented(account: AudienceAccount): boolean {
  return account.marketingOptIn && !account.marketingWithdrawnAt;
}

/**
 * The whole eligibility test. `suppressed` is the set of lowercased addresses
 * Brevo has told us to stop emailing (`marketing_suppressions`).
 *
 * A suppressed address is excluded **even while `marketing_opt_in` is still
 * true**, which is the case that matters: somebody clicks unsubscribe in an
 * email, the webhook writes the suppression, and they are out of the audience
 * from that instant — before, and independently of, the follow-up write that
 * flips their account's own flag.
 */
export function isEligible(
  contact: Pick<MarketingContact, "email">,
  suppressed: ReadonlySet<string>
): boolean {
  const email = normalizeEmail(contact.email);
  if (!isSendableEmail(email)) return false;
  return !suppressed.has(email);
}

/* ------------------------------------------------------------ the audience */

export interface BuildAudienceInput {
  accounts: AudienceAccount[];
  /** Every order with no `customer_id`; grouped here by email. */
  guestOrders: AudienceGuestOrder[];
  /** Keyed by lowercased email for guests, and by `customers.id` for accounts. */
  statsByEmail: ReadonlyMap<string, AudienceStats>;
  suppressed: ReadonlySet<string>;
}

/**
 * Every contact Brevo should hold, newest consent first.
 *
 * Two populations, because the schema has two. An address that is both a
 * guest and an account appears **once, as the account** — the same precedence
 * `customerIdForEmail()` applies when an order is linked, and the reason the
 * admin Customers screen and this list can never disagree about whether two
 * orders were the same person.
 *
 * A guest counts as consented if **any** of their orders carried the tick.
 * Consent is not withdrawn by placing a later order without ticking the box,
 * because the checkout form only ever shows that box to somebody who has not
 * already consented (`CheckoutForm.tsx` hides it) — so an unticked later
 * order means "already opted in", not "changed their mind".
 */
export function buildAudience(input: BuildAudienceInput): MarketingContact[] {
  const { accounts, guestOrders, statsByEmail, suppressed } = input;

  const contacts = new Map<string, MarketingContact>();

  // Accounts first, so they win over a guest row for the same address.
  for (const account of accounts) {
    const email = normalizeEmail(account.email);
    if (!accountConsented(account)) continue;
    if (!isSendableEmail(email)) continue;

    contacts.set(email, {
      email,
      customerId: account.id,
      kind: "registered",
      name: String(account.name ?? "").trim(),
      phone: cleanPhone(account.phone),
      consentAt: account.marketingConsentAt,
      stats: statsByEmail.get(account.id) ?? statsByEmail.get(email) ?? DEFAULT_STATS,
    });
  }

  // Guests, grouped by email the way `buildGuestCustomers()` groups them.
  // Unlike that function, an order with no email is simply dropped: there is
  // no way to email a phone number, so a `tel:` key has no meaning here.
  const guests = new Map<string, AudienceGuestOrder[]>();
  for (const order of guestOrders) {
    const email = normalizeEmail(order.email);
    if (!isSendableEmail(email)) continue;
    const list = guests.get(email);
    if (list) list.push(order);
    else guests.set(email, [order]);
  }

  for (const [email, orders] of guests) {
    if (contacts.has(email)) continue; // the account already covers them
    const consentedOrders = orders.filter((order) => order.marketingOptIn);
    if (consentedOrders.length === 0) continue;

    // The earliest tick is when they actually consented.
    const consentAt = consentedOrders
      .map((order) => order.placedAt)
      .sort()[0] ?? null;

    // The most recent order has the best name and phone number.
    const latest = [...orders].sort((a, b) => b.placedAt.localeCompare(a.placedAt))[0];

    contacts.set(email, {
      email,
      customerId: null,
      kind: "guest",
      name: String(latest?.name ?? "").trim(),
      phone: cleanPhone(latest?.phone ?? null),
      consentAt,
      stats: statsByEmail.get(email) ?? DEFAULT_STATS,
    });
  }

  return [...contacts.values()]
    .filter((contact) => isEligible(contact, suppressed))
    .sort((a, b) => String(b.consentAt ?? "").localeCompare(String(a.consentAt ?? "")));
}

/** Blank, or a trimmed number. Brevo rejects a contact whose SMS attribute is not E.164. */
function cleanPhone(value: string | null): string | null {
  const text = String(value ?? "").trim();
  if (!text || text === "—") return null;
  const digits = text.replace(/[^\d+]/g, "");
  // Brevo wants +<country><number>; anything we can't be sure of is left out
  // rather than guessed at, since a wrong number in a contact is worse than none.
  if (/^\+[1-9]\d{7,14}$/.test(digits)) return digits;
  if (/^0\d{8,9}$/.test(digits)) return `+31${digits.slice(1)}`; // Dutch national form
  return null;
}

/* --------------------------------------------------------- Brevo payloads */

/**
 * The contact attribute names created in Brevo, so personalisation works in
 * the drag-and-drop editor ({{contact.FIRSTNAME}} and friends). Brevo wants
 * attribute names in capitals.
 *
 * FIRSTNAME/LASTNAME/SMS are Brevo's own built-ins and are not created by us.
 */
export const BREVO_ATTRIBUTES = [
  { name: "LANGUAGE", type: "text" as const },
  { name: "ORDER_COUNT", type: "float" as const },
  { name: "LAST_ORDER_DATE", type: "date" as const },
  { name: "TOTAL_SPENT", type: "float" as const },
  { name: "FAVOURITE_DISH", type: "text" as const },
  { name: "REWARD_POINTS", type: "float" as const },
  { name: "CUSTOMER_TYPE", type: "text" as const },
] as const;

export interface BrevoContactAttributes {
  FIRSTNAME: string;
  LASTNAME: string;
  SMS?: string;
  LANGUAGE: string;
  ORDER_COUNT: number;
  LAST_ORDER_DATE?: string;
  TOTAL_SPENT: number;
  FAVOURITE_DISH?: string;
  REWARD_POINTS?: number;
  CUSTOMER_TYPE: ContactKind;
}

/** "Farhan Ahmad Qilash" -> { FIRSTNAME: "Farhan", LASTNAME: "Ahmad Qilash" }. */
export function splitName(full: string): { first: string; last: string } {
  const parts = String(full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/** Brevo's date attributes want YYYY-MM-DD, not an ISO timestamp. */
export function dateOnly(value: string | null | undefined): string | undefined {
  const text = String(value ?? "");
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(text);
  return match ? match[1] : undefined;
}

export function buildContactAttributes(contact: MarketingContact): BrevoContactAttributes {
  const { first, last } = splitName(contact.name);
  const stats = contact.stats;

  const attributes: BrevoContactAttributes = {
    FIRSTNAME: first,
    LASTNAME: last,
    LANGUAGE: stats.language,
    ORDER_COUNT: stats.orderCount,
    TOTAL_SPENT: Math.round(stats.totalSpentCents) / 100,
    CUSTOMER_TYPE: contact.kind,
  };

  if (contact.phone) attributes.SMS = contact.phone;
  const lastOrder = dateOnly(stats.lastOrderAt);
  if (lastOrder) attributes.LAST_ORDER_DATE = lastOrder;
  if (stats.favouriteDish) attributes.FAVOURITE_DISH = stats.favouriteDish.slice(0, 120);
  if (stats.rewardPoints !== null) attributes.REWARD_POINTS = stats.rewardPoints;

  return attributes;
}

/** One row of a `POST /v3/contacts/import` body. */
export interface BrevoImportRow {
  email: string;
  attributes: BrevoContactAttributes;
}

export function buildImportRows(contacts: MarketingContact[]): BrevoImportRow[] {
  return contacts.map((contact) => ({
    email: contact.email,
    attributes: buildContactAttributes(contact),
  }));
}

/**
 * Brevo's import body is capped at 10 MB and it recommends staying near 8.
 * At one kitchen this will be a few hundred contacts, nowhere near either —
 * but the batch size keeps a single enormous request from ever being built,
 * and lets the admin show progress.
 */
export const IMPORT_BATCH_SIZE = 500;

export function batched<T>(rows: T[], size = IMPORT_BATCH_SIZE): T[][] {
  if (size < 1) throw new Error("batch size must be at least 1");
  const batches: T[][] = [];
  for (let i = 0; i < rows.length; i += size) batches.push(rows.slice(i, i + size));
  return batches;
}

/* -------------------------------------------------------- recipient counts */

/** What the admin confirmation dialog says before a send goes out. */
export interface RecipientSummary {
  /** Addresses that will actually be sent to. */
  eligible: string[];
  /** Picked by the admin but not eligible, with the reason, so the dialog can say so. */
  skipped: { email: string; reason: "suppressed" | "no-consent" | "bad-email" }[];
}

/**
 * Filter an admin's chosen addresses down to the ones that may be emailed.
 *
 * This runs on the server before any campaign is created. An address the
 * admin typed, pasted or selected from a stale page that is not in the
 * audience is dropped and reported — never sent to.
 */
export function resolveRecipients(
  chosen: readonly string[],
  audience: readonly MarketingContact[],
  suppressed: ReadonlySet<string>
): RecipientSummary {
  const byEmail = new Map(audience.map((contact) => [contact.email, contact]));
  const eligible: string[] = [];
  const skipped: RecipientSummary["skipped"] = [];
  const seen = new Set<string>();

  for (const raw of chosen) {
    const email = normalizeEmail(raw);
    if (seen.has(email)) continue;
    seen.add(email);

    if (!isSendableEmail(email)) {
      skipped.push({ email: email || String(raw), reason: "bad-email" });
      continue;
    }
    if (suppressed.has(email)) {
      skipped.push({ email, reason: "suppressed" });
      continue;
    }
    if (!byEmail.has(email)) {
      skipped.push({ email, reason: "no-consent" });
      continue;
    }
    eligible.push(email);
  }

  return { eligible, skipped };
}
