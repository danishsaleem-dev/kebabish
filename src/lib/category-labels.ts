/**
 * The six original categories have translated names in messages/*.json, so
 * they switch with the language. Anything Danish adds in /admin has only
 * the label he typed, in one language.
 *
 * Rather than dropping translation for the existing six (which would make
 * the Dutch site suddenly show English headings), resolve translated names
 * for the known ids and fall back to the stored label for the rest.
 *
 * Danish has parked the "should categories be bilingual" question; when
 * he answers, this is the one place it changes.
 */
const TRANSLATED_CATEGORY_IDS = new Set([
  "mainDishes",
  "kebabsStarters",
  "breads",
  "fastFoodWraps",
  "specialtiesSides",
  "dessertsDrinks",
]);

export function resolveCategoryLabel(
  id: string,
  storedLabel: string,
  t: (key: string) => string
): string {
  return TRANSLATED_CATEGORY_IDS.has(id) ? t(`categories.${id}`) : storedLabel;
}
