/**
 * Checks for the marketing-audience rules (src/lib/brevo/audience.ts). No database,
 * no network. Run: npx tsx scripts/check-audience.mts
 *
 * These are the rules that decide who gets a marketing email, so they are
 * worth having a script behind: a mistake here either emails somebody who
 * unsubscribed, or quietly drops somebody who did consent.
 */
import {
  type AudienceAccount,
  type AudienceGuestOrder,
  type AudienceStats,
  DEFAULT_STATS,
  accountConsented,
  batched,
  buildAudience,
  buildContactAttributes,
  buildImportRows,
  dateOnly,
  isEligible,
  isSendableEmail,
  normalizeEmail,
  resolveRecipients,
  splitName,
} from "../src/lib/brevo/audience";

let failed = 0;
let passed = 0;
function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else {
    failed++;
    console.error(
      `FAIL ${name}\n  expected ${JSON.stringify(expected)}\n  got      ${JSON.stringify(actual)}`
    );
  }
}

/* --------------------------------------------------------------- addresses */

check("plain address", isSendableEmail("sanne@example.nl"), true);
check("trims and lowercases", normalizeEmail("  Sanne@Example.NL "), "sanne@example.nl");
check("empty is not sendable", isSendableEmail(""), false);
check("null is not sendable", isSendableEmail(null), false);
check("no at sign", isSendableEmail("sanne.example.nl"), false);
check("two at signs", isSendableEmail("a@b@example.nl"), false);
check("no dot in domain", isSendableEmail("sanne@example"), false);
check("domain ends in a dot", isSendableEmail("sanne@example."), false);
check("double dot", isSendableEmail("sanne..de@example.nl"), false);
check("a space", isSendableEmail("sanne de@example.nl"), false);
check("a comma (would break an import)", isSendableEmail("a,b@example.nl"), false);
check("angle brackets", isSendableEmail("<sanne@example.nl>"), false);
check("too long", isSendableEmail(`${"a".repeat(250)}@example.nl`), false);

/* -------------------------------------------------------------- consent */

function account(over: Partial<AudienceAccount> = {}): AudienceAccount {
  return {
    id: "acc-1",
    email: "sanne@example.nl",
    name: "Sanne de Vries",
    phone: "0612345678",
    marketingOptIn: true,
    marketingWithdrawnAt: null,
    marketingConsentAt: "2026-10-01T10:00:00.000Z",
    ...over,
  };
}

check("ticked and not withdrawn", accountConsented(account()), true);
check("never ticked", accountConsented(account({ marketingOptIn: false })), false);
check(
  "withdrawn, even with the flag still true",
  accountConsented(account({ marketingWithdrawnAt: "2026-11-01T10:00:00.000Z" })),
  false
);

/* ------------------------------------------------------------- the audience */

function guestOrder(over: Partial<AudienceGuestOrder> = {}): AudienceGuestOrder {
  return {
    email: "guest@example.nl",
    name: "Bram Jansen",
    phone: "+31612345678",
    marketingOptIn: true,
    placedAt: "2026-10-05T18:00:00.000Z",
    ...over,
  };
}

const noStats = new Map<string, AudienceStats>();
const none = new Set<string>();

check(
  "a consenting account is in",
  buildAudience({ accounts: [account()], guestOrders: [], statsByEmail: noStats, suppressed: none })
    .map((c) => c.email),
  ["sanne@example.nl"]
);

check(
  "an account that never ticked the box is out",
  buildAudience({
    accounts: [account({ marketingOptIn: false })],
    guestOrders: [],
    statsByEmail: noStats,
    suppressed: none,
  }).length,
  0
);

check(
  "an account that withdrew is out",
  buildAudience({
    accounts: [account({ marketingWithdrawnAt: "2026-11-01T00:00:00.000Z" })],
    guestOrders: [],
    statsByEmail: noStats,
    suppressed: none,
  }).length,
  0
);

check(
  "a guest with a ticked order is in",
  buildAudience({
    accounts: [],
    guestOrders: [guestOrder()],
    statsByEmail: noStats,
    suppressed: none,
  }).map((c) => [c.email, c.kind]),
  [["guest@example.nl", "guest"]]
);

check(
  "a guest who never ticked is out",
  buildAudience({
    accounts: [],
    guestOrders: [guestOrder({ marketingOptIn: false })],
    statsByEmail: noStats,
    suppressed: none,
  }).length,
  0
);

check(
  "one ticked order out of three is enough",
  buildAudience({
    accounts: [],
    guestOrders: [
      guestOrder({ marketingOptIn: false, placedAt: "2026-09-01T00:00:00.000Z" }),
      guestOrder({ marketingOptIn: true, placedAt: "2026-09-10T00:00:00.000Z" }),
      guestOrder({ marketingOptIn: false, placedAt: "2026-10-01T00:00:00.000Z" }),
    ],
    statsByEmail: noStats,
    suppressed: none,
  }).map((c) => c.consentAt),
  ["2026-09-10T00:00:00.000Z"]
);

check(
  "a guest order with no email is dropped, not keyed on a phone number",
  buildAudience({
    accounts: [],
    guestOrders: [guestOrder({ email: null })],
    statsByEmail: noStats,
    suppressed: none,
  }).length,
  0
);

// The one that keeps the Email marketing screens and the Customers screen
// agreeing about whether two orders were the same person.
check(
  "the same address as both an account and a guest appears once, as the account",
  buildAudience({
    accounts: [account({ email: "both@example.nl", name: "Account Name" })],
    guestOrders: [guestOrder({ email: "BOTH@example.nl", name: "Guest Name" })],
    statsByEmail: noStats,
    suppressed: none,
  }).map((c) => [c.email, c.kind, c.name]),
  [["both@example.nl", "registered", "Account Name"]]
);

check(
  "a guest keeps the newest order's name and number",
  buildAudience({
    accounts: [],
    guestOrders: [
      guestOrder({ name: "Old Name", phone: "+31600000000", placedAt: "2026-01-01T00:00:00.000Z" }),
      guestOrder({ name: "New Name", phone: "+31611111111", placedAt: "2026-10-01T00:00:00.000Z" }),
    ],
    statsByEmail: noStats,
    suppressed: none,
  }).map((c) => [c.name, c.phone]),
  [["New Name", "+31611111111"]]
);

/* ---------------------------------------------------------- suppression */

const suppressed = new Set(["sanne@example.nl"]);

check(
  "a suppressed address is out even while opt-in is still true",
  buildAudience({
    accounts: [account()],
    guestOrders: [],
    statsByEmail: noStats,
    suppressed,
  }).length,
  0
);

check(
  "a suppressed guest is out",
  buildAudience({
    accounts: [],
    guestOrders: [guestOrder({ email: "sanne@example.nl" })],
    statsByEmail: noStats,
    suppressed,
  }).length,
  0
);

check("isEligible: clean", isEligible({ email: "ok@example.nl" }, suppressed), true);
check("isEligible: suppressed", isEligible({ email: "SANNE@example.nl" }, suppressed), false);
check("isEligible: junk address", isEligible({ email: "nope" }, none), false);

check(
  "newest consent first",
  buildAudience({
    accounts: [
      account({ id: "a", email: "a@example.nl", marketingConsentAt: "2026-01-01T00:00:00.000Z" }),
      account({ id: "b", email: "b@example.nl", marketingConsentAt: "2026-10-01T00:00:00.000Z" }),
    ],
    guestOrders: [],
    statsByEmail: noStats,
    suppressed: none,
  }).map((c) => c.email),
  ["b@example.nl", "a@example.nl"]
);

/* ----------------------------------------------------------- phone numbers */

function phoneOf(input: string | null): string | null {
  return buildAudience({
    accounts: [account({ phone: input })],
    guestOrders: [],
    statsByEmail: noStats,
    suppressed: none,
  })[0].phone;
}

check("Dutch national form becomes E.164", phoneOf("0612345678"), "+31612345678");
check("already E.164", phoneOf("+31612345678"), "+31612345678");
check("spaces and dashes are stripped", phoneOf("06 12 34-56 78"), "+31612345678");
check("the admin's em-dash placeholder is not a number", phoneOf("—"), null);
check("nonsense is left out rather than guessed", phoneOf("12"), null);
check("no number at all", phoneOf(null), null);

/* ------------------------------------------------------------- attributes */

check("one word", splitName("Sanne"), { first: "Sanne", last: "" });
check("two words", splitName("Sanne de"), { first: "Sanne", last: "de" });
check("three words", splitName("Farhan Ahmad Qilash"), { first: "Farhan", last: "Ahmad Qilash" });
check("extra spaces", splitName("  Sanne   de Vries "), { first: "Sanne", last: "de Vries" });
check("empty", splitName(""), { first: "", last: "" });

check("a date attribute is day-only", dateOnly("2026-10-05T18:00:00.000Z"), "2026-10-05");
check("no date", dateOnly(null), undefined);
check("not a date", dateOnly("soon"), undefined);

const contact = buildAudience({
  accounts: [account()],
  guestOrders: [],
  statsByEmail: new Map([
    [
      "acc-1",
      {
        orderCount: 4,
        lastOrderAt: "2026-11-01T19:30:00.000Z",
        totalSpentCents: 8650,
        favouriteDish: "Chicken Biryani",
        language: "en" as const,
        rewardPoints: 865,
      },
    ],
  ]),
  suppressed: none,
})[0];

check("attributes", buildContactAttributes(contact), {
  FIRSTNAME: "Sanne",
  LASTNAME: "de Vries",
  LANGUAGE: "en",
  ORDER_COUNT: 4,
  TOTAL_SPENT: 86.5,
  CUSTOMER_TYPE: "registered",
  SMS: "+31612345678",
  LAST_ORDER_DATE: "2026-11-01",
  FAVOURITE_DISH: "Chicken Biryani",
  REWARD_POINTS: 865,
});

const bare = buildAudience({
  accounts: [account({ phone: null, name: "Bram" })],
  guestOrders: [],
  statsByEmail: noStats,
  suppressed: none,
})[0];

check("no optional attribute is sent as null or empty", buildContactAttributes(bare), {
  FIRSTNAME: "Bram",
  LASTNAME: "",
  LANGUAGE: "nl",
  ORDER_COUNT: 0,
  TOTAL_SPENT: 0,
  CUSTOMER_TYPE: "registered",
});

check("money reaches Brevo in euros, not cents", DEFAULT_STATS.totalSpentCents, 0);
check(
  "import rows carry the address and the attributes only",
  Object.keys(buildImportRows([contact])[0]).sort(),
  ["attributes", "email"]
);

/* ---------------------------------------------------------------- batching */

check("a short list is one batch", batched([1, 2, 3], 500).length, 1);
check("an exact multiple does not make an empty trailing batch", batched([1, 2, 3, 4], 2).length, 2);
check("batch sizes", batched([1, 2, 3, 4, 5], 2).map((b) => b.length), [2, 2, 1]);
check("nothing to batch", batched([], 10).length, 0);

/* ------------------------------------------------------- chosen recipients */

const audience = buildAudience({
  accounts: [
    account({ id: "a", email: "in@example.nl" }),
    account({ id: "b", email: "also@example.nl" }),
  ],
  guestOrders: [],
  statsByEmail: noStats,
  suppressed: none,
});

check(
  "a chosen address that consented is kept",
  resolveRecipients(["in@example.nl"], audience, none),
  { eligible: ["in@example.nl"], skipped: [] }
);

check(
  "an address nobody consented for is refused, not sent",
  resolveRecipients(["stranger@example.nl"], audience, none),
  { eligible: [], skipped: [{ email: "stranger@example.nl", reason: "no-consent" }] }
);

check(
  "a suppressed address is refused even though it is in the audience list",
  resolveRecipients(["in@example.nl"], audience, new Set(["in@example.nl"])),
  { eligible: [], skipped: [{ email: "in@example.nl", reason: "suppressed" }] }
);

check(
  "junk is refused",
  resolveRecipients(["not-an-address"], audience, none),
  { eligible: [], skipped: [{ email: "not-an-address", reason: "bad-email" }] }
);

check(
  "the same address twice is one recipient",
  resolveRecipients(["in@example.nl", "IN@example.nl"], audience, none).eligible,
  ["in@example.nl"]
);

check(
  "a mixed selection keeps the good and names the rest",
  resolveRecipients(
    ["in@example.nl", "stranger@example.nl", "also@example.nl", "junk"],
    audience,
    none
  ),
  {
    eligible: ["in@example.nl", "also@example.nl"],
    skipped: [
      { email: "stranger@example.nl", reason: "no-consent" },
      { email: "junk", reason: "bad-email" },
    ],
  }
);

check("nothing chosen", resolveRecipients([], audience, none), { eligible: [], skipped: [] });

console.log(`${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
