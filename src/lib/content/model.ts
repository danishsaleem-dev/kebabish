/**
 * The rules of editable content, with no database and no React in them: what a
 * valid value looks like, how overrides are laid over the shipped messages, how
 * the homepage section list is resolved, and what a media slot is.
 *
 * Kept pure so it can be exercised directly against the real message files
 * (see scripts/check-content.mts) — the parts that can take the site down if
 * they're wrong are all in here, so they are the parts that get tested.
 */
import { IntlMessageFormat } from "intl-messageformat";
import { ALL_FIELDS, fieldFor, type FieldDef } from "./registry";

export type Messages = Record<string, unknown>;

export interface FaqEntry {
  q: string;
  a: string;
}

/** What one stored value can be. Which one is decided by the field's `kind`. */
export type ContentValue = string | string[] | FaqEntry[];

// ---------------------------------------------------------------------------
// Reading a path in the messages
// ---------------------------------------------------------------------------

export function getPath(messages: Messages, key: string): unknown {
  let node: unknown = messages;
  for (const part of key.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return node;
}

function setPath(messages: Messages, key: string, value: unknown): void {
  const parts = key.split(".");
  let node = messages as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const next = node[part];
    if (next === null || typeof next !== "object") return; // path doesn't exist: never invent one
    node = next as Record<string, unknown>;
  }
  node[parts[parts.length - 1]] = value;
}

// ---------------------------------------------------------------------------
// ICU: the part that can take a page down
// ---------------------------------------------------------------------------
//
// Every `t("…")` string is parsed as an ICU message. Curly braces open an
// argument, `<b>` is a tag that needs a handler, and `{n, plural, …}` is a rule.
// A stray `{` typed into a heading would therefore throw while the page renders
// — a 500 on the homepage from a text edit. So an edited string is parsed here
// first, and only plain text plus the placeholders its default already had is let
// through.

const AST_LITERAL = 0;
const AST_ARGUMENT = 1;

/**
 * The placeholder names an ICU message uses, or an error message for the owner.
 * Only literal text and simple `{name}` arguments are allowed.
 */
export function icuArgs(message: string, locale: string): { args: string[] } | { error: string } {
  let ast;
  try {
    ast = new IntlMessageFormat(message, locale).getAst();
  } catch {
    return {
      error:
        "Curly braces { } and some other symbols have a special meaning on this site. Remove them, or write the text without them.",
    };
  }
  const args: string[] = [];
  for (const node of ast) {
    // The parser's element types are an enum in a transitive package; the two
    // numbers we care about are stable, so read them structurally instead.
    const el = node as { type: number; value: string };
    if (el.type === AST_LITERAL) continue;
    if (el.type === AST_ARGUMENT) {
      args.push(el.value);
      continue;
    }
    return {
      error:
        "This text can't contain formatting rules or <tags>. Write plain text (and any {placeholder} that was already there).",
    };
  }
  return { args };
}

// ---------------------------------------------------------------------------
// Validating and normalising what the owner typed
// ---------------------------------------------------------------------------

/**
 * Words that must never appear in editable copy. "Marfah Enterprise" is the
 * legal entity and is only ever named on Privacy and Terms (CLAUDE.md). The
 * check is on the registry's fields only, and Privacy/Terms aren't in it.
 */
const FORBIDDEN: { pattern: RegExp; message: string }[] = [
  {
    pattern: /marfah/i,
    message:
      "The company's legal name only appears on the Privacy Policy and Terms. Use “Kebabish” here.",
  },
];

function forbidden(text: string): string | null {
  for (const rule of FORBIDDEN) if (rule.pattern.test(text)) return rule.message;
  return null;
}

/** Tidy whitespace without changing meaning; single-line fields lose line breaks. */
function tidy(raw: string, singleLine: boolean): string {
  let s = raw.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
  s = singleLine ? s.replace(/\s*\n\s*/g, " ") : s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n");
  return s.replace(/[ \t]{2,}/g, " ").trim();
}

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

function checkText(
  raw: unknown,
  field: FieldDef,
  defaultText: string | undefined,
  locale: string
): Checked<string> {
  if (typeof raw !== "string") return { ok: false, error: "Enter some text." };
  const value = tidy(raw, field.kind === "text");
  if (!value) return { ok: false, error: "This can't be empty. Use “Reset to default” to go back to the original." };
  const max = field.max ?? 200;
  if (value.length > max) {
    return { ok: false, error: `Too long: ${value.length} characters, the limit here is ${max}.` };
  }
  const banned = forbidden(value);
  if (banned) return { ok: false, error: banned };

  const parsed = icuArgs(value, locale);
  if ("error" in parsed) return { ok: false, error: parsed.error };
  const allowed = defaultText === undefined ? [] : icuArgsOrEmpty(defaultText, locale);
  const stray = parsed.args.filter((a) => !allowed.includes(a));
  if (stray.length) {
    return {
      ok: false,
      error: allowed.length
        ? `Unknown placeholder {${stray[0]}}. Only ${allowed.map((a) => `{${a}}`).join(" and ")} can be used here.`
        : `Remove {${stray[0]}} — this text has no placeholders.`,
    };
  }
  return { ok: true, value };
}

function icuArgsOrEmpty(message: string, locale: string): string[] {
  const parsed = icuArgs(message, locale);
  return "args" in parsed ? parsed.args : [];
}

function checkStrings(raw: unknown, field: FieldDef): Checked<string[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Enter at least one item." };
  const items = raw.map((r) => (typeof r === "string" ? tidy(r, true) : "")).filter(Boolean);
  if (items.length === 0) return { ok: false, error: "Keep at least one item — or use “Reset to default”." };
  const maxItems = field.maxItems ?? 10;
  if (items.length > maxItems) return { ok: false, error: `At most ${maxItems} items here.` };
  const max = field.max ?? 100;
  const tooLong = items.find((i) => i.length > max);
  if (tooLong) return { ok: false, error: `“${tooLong.slice(0, 30)}…” is too long — the limit is ${max} characters.` };
  for (const item of items) {
    const banned = forbidden(item);
    if (banned) return { ok: false, error: banned };
  }
  return { ok: true, value: items };
}

function checkFaq(raw: unknown, field: FieldDef): Checked<FaqEntry[]> {
  if (!Array.isArray(raw)) return { ok: false, error: "Add at least one question." };
  const entries: FaqEntry[] = [];
  for (const r of raw) {
    const q = typeof r?.q === "string" ? tidy(r.q, true) : "";
    const a = typeof r?.a === "string" ? tidy(r.a, false) : "";
    // A half-filled row is a row someone is still typing: drop it silently
    // only if it is entirely empty, otherwise ask them to finish it.
    if (!q && !a) continue;
    if (!q || !a) return { ok: false, error: "Every question needs both a question and an answer." };
    entries.push({ q, a });
  }
  if (entries.length === 0) return { ok: false, error: "Keep at least one question — or use “Reset to default”." };
  const maxItems = field.maxItems ?? 20;
  if (entries.length > maxItems) return { ok: false, error: `At most ${maxItems} questions.` };
  const maxA = field.max ?? 900;
  for (const e of entries) {
    if (e.q.length > 200) return { ok: false, error: `The question “${e.q.slice(0, 30)}…” is too long (200 characters max).` };
    if (e.a.length > maxA) return { ok: false, error: `The answer to “${e.q.slice(0, 30)}…” is too long (${maxA} characters max).` };
    const banned = forbidden(e.q) ?? forbidden(e.a);
    if (banned) return { ok: false, error: banned };
  }
  return { ok: true, value: entries };
}

/**
 * Validate and clean one field's new value. `defaultMessages` is the shipped
 * messages for that locale: the default string tells us which placeholders are
 * legal. Returns the cleaned value to store, or an error for the owner.
 */
export function checkField(
  key: string,
  raw: unknown,
  locale: string,
  defaultMessages: Messages
): Checked<ContentValue> {
  const field = fieldFor(key);
  if (!field) return { ok: false, error: "This field can't be edited." };
  switch (field.kind) {
    case "text":
    case "longtext": {
      const def = getPath(defaultMessages, key);
      return checkText(raw, field, typeof def === "string" ? def : undefined, locale);
    }
    case "strings":
      return checkStrings(raw, field);
    case "faq":
      return checkFaq(raw, field);
  }
}

/** True when a stored value is the right shape for its field (cheap, no ICU). */
export function shapeMatches(field: FieldDef, value: unknown): boolean {
  switch (field.kind) {
    case "text":
    case "longtext":
      return typeof value === "string" && value.length > 0;
    case "strings":
      return Array.isArray(value) && value.length > 0 && value.every((v) => typeof v === "string");
    case "faq":
      return (
        Array.isArray(value) &&
        value.length > 0 &&
        value.every((v) => typeof v?.q === "string" && typeof v?.a === "string")
      );
  }
}

// ---------------------------------------------------------------------------
// Laying overrides over the shipped messages
// ---------------------------------------------------------------------------

/**
 * Returns a copy of `defaults` with every valid override applied. Anything that
 * is not in the registry, has the wrong shape, or fails ICU parsing is skipped —
 * never thrown — so a bad row can cost one field its edit, but can never cost a
 * visitor the page.
 */
export function applyOverrides(
  defaults: Messages,
  overrides: Record<string, unknown>,
  locale: string
): Messages {
  const merged = structuredClone(defaults);
  for (const [key, value] of Object.entries(overrides)) {
    const field = fieldFor(key);
    if (!field || !shapeMatches(field, value)) continue;
    if (field.kind === "text" || field.kind === "longtext") {
      const def = getPath(defaults, key);
      const parsed = icuArgs(value as string, locale);
      if ("error" in parsed) continue;
      const allowed = typeof def === "string" ? icuArgsOrEmpty(def, locale) : [];
      if (parsed.args.some((a) => !allowed.includes(a))) continue;
    }
    // A key whose default doesn't exist can't be shown anywhere; skip it.
    if (getPath(defaults, key) === undefined) continue;
    setPath(merged, key, value);
  }
  return merged;
}

// ---------------------------------------------------------------------------
// Homepage layout: which sections, in which order
// ---------------------------------------------------------------------------

/**
 * `band` describes a section's full-width background so the editor can warn when
 * two of the same colour would touch and merge into one slab:
 *   dark  = charcoal band · ember = orange band · cream = the paler cream band ·
 *   plain = sits on the page's own cream, no band of its own.
 */
export type Band = "dark" | "ember" | "cream" | "plain";

export interface HomeSectionDef {
  id: string;
  label: string;
  hint: string;
  band: Band;
  /** The top banner has the header floating over it, so it can't move or hide. */
  pinned?: boolean;
  /** Renders nothing until it has real content (photos, reviews). */
  needs?: "photos" | "reviews";
}

export const HOME_SECTIONS: HomeSectionDef[] = [
  { id: "hero", label: "Top banner", hint: "The video banner. Always first.", band: "dark", pinned: true },
  { id: "marquee", label: "Scrolling strip", hint: "The orange strip of short phrases.", band: "ember" },
  { id: "how", label: "How it works", hint: "Four steps from choosing to delivery, on a dark band.", band: "dark" },
  { id: "trust", label: "Payment & trust strip", hint: "A slim row: payment methods, halal, allergens.", band: "plain" },
  { id: "popular", label: "Popular dishes", hint: "The featured dishes.", band: "cream" },
  { id: "story", label: "Our story", hint: "Video and text about the kitchen.", band: "plain" },
  { id: "categories", label: "Menu categories", hint: "The grid of category cards.", band: "plain" },
  { id: "pick", label: "Help me choose + spice guide", hint: "Mood filters, the chilli scale, and “order again” for returning customers.", band: "plain" },
  { id: "why", label: "Why Kebabish", hint: "Five reasons in a tile grid, the halal one large.", band: "cream" },
  { id: "showcase", label: "Photo gallery", hint: "Kitchen photos. Shows once photos are picked in Settings.", band: "plain", needs: "photos" },
  { id: "testimonials", label: "Customer quotes", hint: "Quotes on a dark band. Shows once reviews are added.", band: "dark", needs: "reviews" },
  { id: "founder", label: "A word from us", hint: "The family's note, with a photo once you pick one.", band: "plain" },
  { id: "catering", label: "Catering teaser", hint: "Parties and large orders, on a dark band.", band: "dark" },
  { id: "delivery", label: "Delivery area", hint: "The map and towns.", band: "plain" },
  { id: "faq", label: "Questions & answers", hint: "The FAQ accordion.", band: "cream" },
  { id: "cta", label: "Closing call to action", hint: "The slim orange band above the feedback card.", band: "ember" },
  { id: "feedback", label: "Feedback invitation", hint: "The card with the QR code.", band: "plain" },
];

export interface LayoutEntry {
  id: string;
  enabled: boolean;
}

const SECTION_IDS = new Set(HOME_SECTIONS.map((s) => s.id));

/**
 * Turn whatever is stored into a complete, valid list. Unknown ids are dropped;
 * a section the stored list doesn't mention (one added to the site later) is
 * slotted in after the section that precedes it by default, so a new section
 * appears instead of silently vanishing; the pinned banner is forced first.
 */
export function resolveLayout(stored: unknown): LayoutEntry[] {
  const seen = new Set<string>();
  const out: LayoutEntry[] = [];
  if (Array.isArray(stored)) {
    for (const e of stored) {
      const id = typeof e?.id === "string" ? e.id : "";
      if (!SECTION_IDS.has(id) || seen.has(id)) continue;
      seen.add(id);
      out.push({ id, enabled: e.enabled !== false });
    }
  }
  HOME_SECTIONS.forEach((section, i) => {
    if (seen.has(section.id)) return;
    const prev = HOME_SECTIONS[i - 1]?.id;
    const at = prev ? out.findIndex((e) => e.id === prev) : -1;
    out.splice(at + 1, 0, { id: section.id, enabled: true });
  });
  // The pinned banner: first, and on.
  const heroAt = out.findIndex((e) => e.id === "hero");
  const [hero] = out.splice(heroAt, 1);
  out.unshift({ id: hero.id, enabled: true });
  return out;
}

export function isDefaultLayout(layout: LayoutEntry[]): boolean {
  return (
    layout.length === HOME_SECTIONS.length &&
    layout.every((e, i) => e.id === HOME_SECTIONS[i].id && e.enabled)
  );
}

/**
 * Things worth a second look before saving, never blockers: the owner is allowed
 * to do it, but two same-coloured bands touching will read as one big block.
 * `empty` = sections that currently render nothing (no photos / no reviews), so
 * they don't count as being on the page.
 */
export function layoutWarnings(layout: LayoutEntry[], empty: ReadonlySet<string>): string[] {
  const defs = new Map(HOME_SECTIONS.map((s) => [s.id, s]));
  const shown = layout.filter((e) => e.enabled && !empty.has(e.id)).map((e) => defs.get(e.id)!);
  const warnings: string[] = [];
  for (let i = 1; i < shown.length; i++) {
    const a = shown[i - 1];
    const b = shown[i];
    if (a.band !== "plain" && a.band === b.band) {
      warnings.push(
        `“${a.label}” and “${b.label}” are both ${bandName(a.band)} and sit next to each other, so they will look like one big block.`
      );
    }
  }
  const last = shown[shown.length - 1];
  if (last && last.band === "dark") {
    warnings.push(`“${last.label}” is dark and sits right above the dark footer, so the two will blend together.`);
  }
  return warnings;
}

function bandName(band: Band): string {
  return band === "dark" ? "dark" : band === "ember" ? "orange" : "pale cream";
}

// ---------------------------------------------------------------------------
// Media slots
// ---------------------------------------------------------------------------

export type SlotId = "heroWeb" | "heroMobile" | "story" | "aboutBanner" | "storyDetail" | "founder";

export interface SlotValue {
  video?: string;
  poster?: string;
  image?: string;
}

export interface SlotDef {
  id: SlotId;
  label: string;
  where: string;
  kind: "video" | "image";
  shape: "landscape" | "portrait" | "square";
  /** Advice shown next to the uploader. */
  advice: string;
  /** What shows when nothing has been uploaded: files that ship with the site. */
  fallback: SlotValue;
}

export const MEDIA_SLOTS: SlotDef[] = [
  {
    id: "heroWeb",
    label: "Homepage banner video — computers & tablets",
    where: "The big video at the top of the homepage, on screens wider than a phone.",
    kind: "video",
    shape: "landscape",
    advice: "Wide (16:9), 1080p or better, 5–20 seconds, looping cleanly.",
    fallback: { video: "/video/hero-web.mp4", poster: "/images/hero-poster.jpg" },
  },
  {
    id: "heroMobile",
    label: "Homepage banner video — phones",
    where: "The same banner on a phone. Tall (9:16) so it isn't cropped.",
    kind: "video",
    shape: "portrait",
    advice: "Tall (9:16), 1080×1920, 5–20 seconds, looping cleanly.",
    fallback: { video: "/video/hero-mobile.mp4", poster: "/images/hero-poster-mobile.jpg" },
  },
  {
    id: "story",
    label: "“Our story” video",
    where: "The tall video beside the story text, on the homepage and the About page.",
    kind: "video",
    shape: "portrait",
    advice: "Tall (9:16 or 3:4), 5–20 seconds.",
    fallback: { video: "/video/about-video.mp4", poster: "/images/about-poster.jpg" },
  },
  {
    id: "aboutBanner",
    label: "About page banner video",
    where: "The wide video behind the heading on the About page.",
    kind: "video",
    shape: "landscape",
    advice: "Wide (16:9). If you don't set one, it uses the homepage banner video.",
    fallback: {}, // follows heroWeb
  },
  {
    id: "storyDetail",
    label: "“Our story” small photo",
    where: "The little square photo overlapping the story video.",
    kind: "image",
    shape: "square",
    advice: "Square works best. JPEG, PNG or WebP.",
    fallback: { image: "/images/story/burger.webp" },
  },
  {
    id: "founder",
    label: "“A word from us” photo",
    where: "The photo beside the family's note on the homepage.",
    kind: "image",
    shape: "portrait",
    advice:
      "A tall photo of you, the family or the kitchen team works best. Until you pick one, the note shows the Kebabish logo instead.",
    fallback: {}, // none: the section shows the logo mark rather than an invented photo
  },
];

export const SLOT_BY_ID = new Map(MEDIA_SLOTS.map((s) => [s.id, s]));
export const mediaKey = (id: SlotId) => `media.${id}`;

export function isSlotId(id: string): id is SlotId {
  return SLOT_BY_ID.has(id as SlotId);
}

/** Every field the registry lists, for scripts that need to walk all of them. */
export { ALL_FIELDS };
