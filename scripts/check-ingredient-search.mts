/**
 * Checks for the recipe ingredient picker's search (src/lib/ingredient-search.ts), using the real
 * ingredient names from the price list. No database needed.
 *   npx tsx scripts/check-ingredient-search.mts
 */
import { searchIngredients } from "@/lib/ingredient-search";

let checks = 0;
let failed = 0;
function check(name: string, ok: boolean, detail?: unknown) {
  checks++;
  if (!ok) {
    failed++;
    console.error(`FAIL: ${name}`, detail ?? "");
  }
}

const names: [string, string, string?][] = [
  ["onions", "Onions", "Hilal Supermarkt"],
  ["spring-onion", "Spring Onion", "Hilal Supermarkt"],
  ["garlic", "Garlic", "Hilal Supermarkt"],
  ["garlic-powder", "Garlic Powder", "Little India"],
  ["ginger", "Ginger", "Hilal Supermarkt"],
  ["ginger-powder", "Ginger Powder", "Global Choice Foods"],
  ["turmeric", "Turmeric Powder / Haldi", "Global Choice Foods"],
  ["coriander-fresh", "Fresh Coriander", "Hilal Market"],
  ["coriander-powder", "Coriander Powder", "Little India"],
  ["chicken-leg", "Chicken leg pieces / Drumsticks", "Mevlana"],
  ["chicken-breast", "Boneless chicken / Kipfilet", "Mevlana"],
  ["chilli-green", "Green Chilli", "Hilal Supermarkt"],
  ["chilli-crushed", "TRS Crushed Red Chilli", "Little India"],
  ["rice", "Dawat Basmati Rice", "Global Choice Foods"],
  ["lemon", "Lemon Plus Limoensap", "DekaMarkt"],
  ["jalapeno", "Jalapeño Peppers", "Albert Heijn"],
];
const list = names.map(([id, name, supplier]) => ({ id, name, supplier }));
const ids = (q: string, aliases?: Record<string, string[]>) =>
  searchIngredients(list, q, aliases).map((i) => i.id);

check("empty query returns everything in order", ids("").length === list.length && ids("")[0] === "onions");
check("whitespace-only query returns everything", ids("   ").length === list.length);
check("case-insensitive", ids("GARLIC").join() === "garlic,garlic-powder", ids("GARLIC"));
check("starts-with outranks contains: 'onion'", ids("onion").join() === "onions,spring-onion", ids("onion"));
check("starts-with first: 'ginger'", ids("ginger")[0] === "ginger" && ids("ginger").includes("ginger-powder"));
check("contains match found: 'powder'", ids("powder").sort().join() === "coriander-powder,garlic-powder,ginger-powder,turmeric", ids("powder"));
check("a name that merely contains it ranks after one that starts with it: 'coriander'", ids("coriander").join() === "coriander-powder,coriander-fresh" || ids("coriander").join() === "coriander-fresh,coriander-powder");
check("words in any order: 'powder garlic'", ids("powder garlic").join() === "garlic-powder", ids("powder garlic"));
check("every word must match: 'garlic rice' finds nothing", ids("garlic rice").length === 0);
check("finds the Dutch half of a bilingual name: 'kipfilet'", ids("kipfilet").join() === "chicken-breast");
check("finds by the part after the slash: 'drumsticks'", ids("drumsticks").join() === "chicken-leg");
check("finds by the Urdu word inside the name: 'haldi'", ids("haldi").join() === "turmeric");
check("matches by supplier: 'mevlana'", ids("mevlana").sort().join() === "chicken-breast,chicken-leg");
check("accents ignored both ways: 'jalapeno'", ids("jalapeno").join() === "jalapeno" && ids("jalapeño").join() === "jalapeno");
check("no match returns an empty list, not an error", ids("zzz").length === 0);

const aliases = { turmeric: ["Haldi", "Turmeric Powder"], "chilli-crushed": ["Dhara Mirch"], "coriander-powder": ["Dhania Powder"] };
check("finds by a Roman Urdu alias: 'dhania'", ids("dhania", aliases).join() === "coriander-powder", ids("dhania", aliases));
check("alias-only match ranks after a name match: 'mirch'", ids("mirch", aliases).join() === "chilli-crushed");
check("aliases don't break a plain search", ids("garlic", aliases).join() === "garlic,garlic-powder");
check("does not mutate the input", list.length === names.length && list[0].id === "onions");

console.log(`${checks} checks, ${failed} failed`);
process.exit(failed ? 1 : 0);
