import "server-only";
import { cachedGet } from "@/lib/brevo/client";

/**
 * The templates Danish designs in Brevo's own drag-and-drop editor.
 *
 * We read them and nothing more — no editor of our own, no stored copy, no
 * sync. `GET /v3/smtp/templates` returns `htmlContent`, which is what makes a
 * real preview possible without rebuilding anything.
 *
 * Cached, because `/v3/smtp/*` allows only **300 requests per hour** and the
 * template list is read on every render of the compose screen.
 */

export interface BrevoTemplate {
  id: number;
  name: string;
  subject: string;
  isActive: boolean;
  htmlContent: string;
  testSent: boolean;
  tag: string;
  createdAt: string;
  modifiedAt: string;
  sender?: { name?: string; email?: string; id?: string };
  replyTo?: string;
}

interface TemplateListResponse {
  count: number;
  templates: BrevoTemplate[] | null;
}

/**
 * Active templates, newest first.
 *
 * **Only active ones**, because `POST /v3/emailCampaigns` refuses a
 * `templateId` that isn't active — offering an inactive template in the
 * picker would mean a send that fails at the last step for a reason the admin
 * has no way to see.
 */
export async function listTemplates(): Promise<BrevoTemplate[]> {
  const response = await cachedGet<TemplateListResponse>(
    "/smtp/templates?templateStatus=true&limit=200&offset=0&sort=desc"
  );
  return response.templates ?? [];
}

export async function getTemplate(id: number): Promise<BrevoTemplate | null> {
  const templates = await listTemplates();
  return templates.find((template) => template.id === id) ?? null;
}

/* ----------------------------------------------------- personalisation tags */

/**
 * The contact attributes a template actually uses.
 *
 * Read out of the HTML so the compose screen can say "this template fills in
 * the first name and the favourite dish" instead of listing every attribute
 * that exists. Brevo's template language writes them as `{{contact.FIRSTNAME}}`
 * and, in older templates, `{{ contact.FIRSTNAME | default : "" }}`.
 */
export function personalisationTags(html: string): string[] {
  const found = new Set<string>();
  const pattern = /\{\{\s*contact\.([A-Z0-9_]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) found.add(match[1].toUpperCase());
  return [...found].sort();
}

/**
 * Whether a template carries an unsubscribe link.
 *
 * Brevo adds one to a campaign by default, so a template without the tag is
 * not broken — but it is worth telling the admin, because a template that
 * *does* carry the tag puts the link where the design wants it rather than
 * at the bottom of whatever Brevo appends.
 */
export function hasUnsubscribeTag(html: string): boolean {
  return /\{\{\s*unsubscribe\s*\}\}|unsubscribe\s*\}\}|\[UNSUBSCRIBE\]/i.test(html);
}

/**
 * A template's HTML, made safe to drop into a preview iframe.
 *
 * The HTML comes from Brevo, where Danish wrote it, so it is not hostile — but
 * it is rendered inside a sandboxed iframe with no scripts and no same-origin
 * access regardless, and the unresolved `{{contact.X}}` tags are replaced with
 * a readable placeholder so the preview doesn't show raw template syntax.
 */
export function previewHtml(html: string, sample: Record<string, string> = {}): string {
  return html.replace(
    /\{\{\s*contact\.([A-Z0-9_]+)[^}]*\}\}/gi,
    (_whole, name: string) => sample[name.toUpperCase()] ?? `[${name.toUpperCase()}]`
  );
}

/** What the preview fills the tags in with, so the layout reads like a real email. */
export const PREVIEW_SAMPLE: Record<string, string> = {
  FIRSTNAME: "Sanne",
  LASTNAME: "de Vries",
  LANGUAGE: "nl",
  ORDER_COUNT: "4",
  LAST_ORDER_DATE: "2026-11-01",
  TOTAL_SPENT: "86.50",
  FAVOURITE_DISH: "Chicken Biryani",
  REWARD_POINTS: "865",
  CUSTOMER_TYPE: "registered",
};
