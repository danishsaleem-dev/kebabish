import "server-only";
import nl from "../../../messages/nl.json";
import en from "../../../messages/en.json";
import type { Messages } from "@/lib/content/model";

/**
 * The text that ships with the site, by language. The admin editor shows these
 * as the "default" under every field, validation uses them to know which
 * placeholders a string may contain, and "reset to default" means going back to
 * exactly these.
 */
export const DEFAULT_MESSAGES: Record<"nl" | "en", Messages> = {
  nl: nl as Messages,
  en: en as Messages,
};
