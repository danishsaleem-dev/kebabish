/** Lowercase and strip accents, so "Jalapeño" is found by "jalapeno". */
export const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

interface Searchable {
  id: string;
  name: string;
  supplier?: string;
}

/**
 * Narrows ingredients for the recipe picker. Every word typed must appear somewhere in the
 * ingredient's name, supplier or aliases (e.g. the Roman Urdu name), in any order; names that
 * start with the first word come first, then names containing it, then matches found only via
 * the supplier or an alias. No words typed returns everything, in the given order.
 */
export function searchIngredients<T extends Searchable>(
  ingredients: T[],
  query: string,
  aliases: Record<string, string[]> = {}
): T[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return ingredients;
  const scored: { ingredient: T; rank: number; order: number }[] = [];
  ingredients.forEach((ingredient, order) => {
    const nameText = fold(ingredient.name);
    const hay = [nameText, fold(ingredient.supplier ?? ""), ...(aliases[ingredient.id] ?? []).map(fold)].join(" ");
    if (!words.every((w) => hay.includes(w))) return;
    const rank = nameText.startsWith(words[0]) ? 0 : nameText.includes(words[0]) ? 1 : 2;
    scored.push({ ingredient, rank, order });
  });
  return scored.sort((a, b) => a.rank - b.rank || a.order - b.order).map((s) => s.ingredient);
}
