import type { FieldKind } from "@/lib/content/registry";
import type { ContentValue } from "@/lib/content/model";

/** What the server hands the text editor for one field, in both languages. */
export interface EditorField {
  key: string;
  label: string;
  kind: FieldKind;
  hint?: string;
  max?: number;
  maxItems?: number;
  seo?: "title" | "description";
  /** The text that ships with the site. */
  defaults: { nl: ContentValue; en: ContentValue };
  /** The owner's override, or null when the field is on its default. */
  saved: { nl: ContentValue | null; en: ContentValue | null };
  /** When and by whom the override was last changed. */
  meta: { nl?: { at: string; by: string | null }; en?: { at: string; by: string | null } };
}

export interface EditorSection {
  id: string;
  title: string;
  where?: string;
  fields: EditorField[];
}
