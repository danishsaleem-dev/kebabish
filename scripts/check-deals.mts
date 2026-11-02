/**
 * Checks for the deal rules (src/lib/deals.ts). No database needed.
 *   npx tsx scripts/check-deals.mts
 */
import {
  REMOVED,
  dealLineName,
  dealProblems,
  dealWasCents,
  evaluateDeal,
  lineHref,
  suggestedCredits,
  dealLineSlug,
} from "@/lib/deals";
import type { StoredDeal } from "@/lib/admin/store/types";

let checks = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  checks++;
  if (!ok) {
    failed++;
    console.error(`FAIL: ${name}`, detail ?? "");
  }
}

const prices: Record<string, number> = { biryani: 1400, naan: 300, cola: 250, fanta: 200, raita: 200 };
const priceOf = (slug: string) => prices[slug] ?? null;
const nameOf = (slug: string) => slug;

const deal = (over: Partial<StoredDeal> = {}): StoredDeal => ({
  slug: "family",
  name: "Familie",
  description: "",
  price: 20,
  minItems: 1,
  visible: true,
  createdAt: "",
  slots: [
    { id: "main", quantity: 1, itemSlugs: ["biryani"], removable: false, removeCredit: 0 },
    { id: "bread", quantity: 2, itemSlugs: ["naan"], removable: true, removeCredit: 4.5 },
    { id: "drink", label: "Kies", quantity: 1, itemSlugs: ["cola", "fanta"], removable: true, removeCredit: 1.5 },
  ],
  ...over,
});
const full = { main: "biryani", bread: "naan", drink: "cola" };

// ---- the price
{
  const r = evaluateDeal(deal(), full, priceOf);
  check("whole deal is the deal price", r.ok && r.unitCents === 2000 && r.creditCents === 0, r);
  check("worth = chosen dishes × portions", r.ok && r.listCents === 1400 + 600 + 250, r);
}
{
  const r = evaluateDeal(deal(), { ...full, bread: REMOVED }, priceOf);
  check("removing takes off the owner's credit", r.ok && r.unitCents === 1550 && r.creditCents === 450, r);
  check("removed part leaves what it was worth", r.ok && r.listCents === 1650, r);
  check("removed part isn't counted as kept", r.ok && r.kept === 2, r);
}
{
  const r = evaluateDeal(deal(), { main: "biryani", bread: REMOVED, drink: REMOVED }, priceOf);
  check("two removals add up", r.ok && r.unitCents === 1400, r);
}
{
  const r = evaluateDeal(deal(), { ...full, drink: "fanta" }, priceOf);
  check("the choice doesn't change the deal price", r.ok && r.unitCents === 2000 && r.listCents === 2200, r);
}

// ---- what the browser must not be able to do
const refused = (name: string, picks: Record<string, string>, error: string, d = deal()) => {
  const r = evaluateDeal(d, picks, priceOf);
  check(name, !r.ok && r.error === error, r);
};
refused("a missing part is refused", { main: "biryani", bread: "naan" }, "missingPick");
refused("a dish from outside the part is refused", { ...full, drink: "biryani" }, "badPick");
refused("a fixed part can't be removed", { ...full, main: REMOVED }, "notRemovable");
refused("too few left is refused", { ...full, bread: REMOVED, drink: REMOVED }, "tooFew", deal({ minItems: 2 }));
{
  const open = deal({ slots: deal().slots.map((s) => ({ ...s, removable: true, removeCredit: 5 })) });
  refused("everything can't be removed", { main: REMOVED, bread: REMOVED, drink: REMOVED }, "tooFew", open);
}

// ---- the crossed-out price
check("was uses the cheapest choice", dealWasCents(deal(), priceOf) === 1400 + 600 + 200);
check("an unpriced dish counts as nothing", dealWasCents(deal({ slots: [{ id: "x", quantity: 1, itemSlugs: ["gone"], removable: false, removeCredit: 0 }] }), priceOf) === 0);

// ---- what the admin form says
const errors = (d: StoredDeal) => dealProblems(d, priceOf, nameOf).errors;
const warnings = (d: StoredDeal) => dealProblems(d, priceOf, nameOf).warnings;
check("a good deal has no errors", errors(deal()).length === 0, errors(deal()));
check("a good deal has no warnings", warnings(deal()).length === 0, warnings(deal()));
check("a tiny price is refused", errors(deal({ price: 0.2 })).length > 0);
check("no parts is refused", errors(deal({ slots: [] })).length > 0);
check("must-keep above parts is refused", errors(deal({ minItems: 4 })).length > 0);
check(
  "a choice with no heading is refused",
  errors(deal({ slots: deal().slots.map((s) => ({ ...s, label: "" })) })).length > 0
);
{
  const free = deal({ price: 6, slots: deal().slots.map((s) => (s.removable ? { ...s, removeCredit: 3 } : s)) });
  check("credits can't make the deal free", errors(free).some((e) => e.includes("most parts removed")), errors(free));
  check("must-keep limits how much can come off", errors({ ...free, minItems: 2 }).length === 0, errors({ ...free, minItems: 2 }));
}
check("a deal dearer than separately is flagged", warnings(deal({ price: 25 })).some((w) => w.includes("saves the customer nothing")));
{
  const stingy = deal({ slots: deal().slots.map((s) => (s.id === "bread" ? { ...s, removeCredit: 0.1 } : s)) });
  check("a removal that costs more than separate is flagged", warnings(stingy).some((w) => w.includes("Take more off")), warnings(stingy));
}

// ---- suggested amounts
{
  const credits = suggestedCredits(deal(), priceOf);
  check("suggestions cover every part", Object.keys(credits).length === 3, credits);
  check("suggestions follow the share of the price", credits.bread === 5.5 && credits.drink === 1.8, credits);
  check("suggestions never exceed the deal", credits.main + credits.bread + credits.drink <= 20.1, credits);
  const applied = deal({ slots: deal().slots.map((s) => (s.removable ? { ...s, removeCredit: credits[s.id] } : s)) });
  check("suggestions pass the rules", errors(applied).length === 0, errors(applied));
}

// ---- names and links
check("a line says it is a deal", dealLineName("Familie") === "Deal: Familie");
check("not twice", dealLineName("Familie Deal") === "Familie Deal");
check("deal link", lineHref(dealLineSlug("family")) === "/deals/family");
check("dish link unchanged", lineHref("biryani") === "/menu/biryani");

console.log(`${checks - failed}/${checks} checks passed`);
process.exit(failed ? 1 : 0);
