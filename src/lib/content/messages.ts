import "server-only";
import { applyOverrides, type Messages } from "@/lib/content/model";
import { getContent, type ContentSnapshot } from "@/lib/content/store";

/**
 * The messages every page renders with: the shipped messages/<locale>.json with
 * the owner's edits laid over them.
 *
 * Called from `src/i18n/request.ts`, which is why no component had to change —
 * `t("home.whyTitle")` is simply answered from this object now. With no edits
 * (or if the database can't be reached) it is exactly the shipped file.
 *
 * Merging is a structuredClone plus ~100 assignments, so it is done once per
 * snapshot and language rather than once per request.
 */
const merged = new WeakMap<ContentSnapshot, Map<string, Messages>>();

export async function getMergedMessages(
  locale: "nl" | "en",
  defaults: Messages
): Promise<Messages> {
  const snapshot = await getContent();
  const overrides = snapshot.text[locale];
  if (Object.keys(overrides).length === 0) return defaults;

  let perLocale = merged.get(snapshot);
  if (!perLocale) merged.set(snapshot, (perLocale = new Map()));
  let result = perLocale.get(locale);
  if (!result) perLocale.set(locale, (result = applyOverrides(defaults, overrides, locale)));
  return result;
}
