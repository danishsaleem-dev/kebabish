import { notFound } from "next/navigation";

/**
 * Catches every address under a language that no real page matches
 * (/en/typo, /oud-menu, …) and hands it to the 404 page in `../not-found.tsx`,
 * so a mistyped or outdated link gets the branded, translated page with a way
 * back to the menu instead of Next's bare fallback. Lowest priority: real
 * pages always win over a catch-all.
 */
export default function CatchAll() {
  notFound();
}
