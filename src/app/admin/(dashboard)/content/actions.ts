"use server";

import { randomBytes } from "node:crypto";
import sharp from "sharp";
import { revalidatePath } from "next/cache";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { deleteVideoByUrl, isOwnVideoUrl } from "@/lib/admin/videos";
import { DEFAULT_MESSAGES } from "@/lib/content/defaults";
import {
  SLOT_BY_ID,
  checkField,
  getPath,
  isDefaultLayout,
  isSlotId,
  mediaKey,
  resolveLayout,
  type ContentValue,
  type LayoutEntry,
  type SlotValue,
} from "@/lib/content/model";
import { LAYOUT_KEY, REVIEWS_KEY, fieldFor } from "@/lib/content/registry";
import { POSTER_FOLDER, deletePosterByUrl, isOwnMediaUrl } from "@/lib/content/storage";
import {
  ContentSetupError,
  listOverrides,
  readHistory,
  saveChanges,
  type AnyLocale,
  type ContentChange,
  type ContentLocale,
} from "@/lib/content/store";
import { supabaseAdmin } from "@/lib/supabase/server";
import type { Review } from "@/lib/reviews-data";

/**
 * Every mutating action here checks the role itself (`requireRole`): a server
 * action is a public POST endpoint, and the layout guard only protects the page.
 * Owner and staff may edit the website; managers (food items only) may not.
 */

export interface SaveResult {
  ok: boolean;
  message?: string;
  /** Per-field problems, keyed `${key}|${locale}`. When present, nothing was saved. */
  errors?: Record<string, string>;
  /** What was stored, cleaned (whitespace tidied), keyed `${key}|${locale}`. null = reset. */
  saved?: Record<string, ContentValue | null>;
}

const LOCALES = new Set<ContentLocale>(["nl", "en"]);

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function setupMessage(error: unknown): string {
  return error instanceof ContentSetupError
    ? "The content tables aren't set up yet. Run supabase/migrations/0019_site_content.sql in Supabase first."
    : error instanceof Error
      ? error.message
      : "Something went wrong.";
}

/**
 * Make the public site pick an edit up now rather than at the next 60-second
 * revalidation: both languages' pages, the sitemap (the reviews page appears in
 * it only once there are reviews) and the admin screens that show the content.
 */
function publish() {
  revalidatePath("/", "layout");
  revalidatePath("/en", "layout");
  revalidatePath("/sitemap.xml");
  revalidatePath("/admin/content", "layout");
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

export interface FieldChange {
  key: string;
  locale: string;
  value: unknown;
}

export async function saveContentAction(input: { changes: FieldChange[] }): Promise<SaveResult> {
  const session = await requireRole(OWNER_STAFF);
  const changes = Array.isArray(input?.changes) ? input.changes : [];
  if (changes.length === 0) return { ok: true, message: "Nothing to save." };
  if (changes.length > 400) return { ok: false, message: "Too many changes at once." };

  let current;
  try {
    current = await listOverrides();
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }
  const stored = new Map(current.map((r) => [`${r.key}|${r.locale}`, r.value]));

  const errors: Record<string, string> = {};
  const toWrite: ContentChange[] = [];
  const saved: Record<string, ContentValue | null> = {};

  for (const change of changes) {
    const id = `${change.key}|${change.locale}`;
    if (!fieldFor(change.key) || !LOCALES.has(change.locale as ContentLocale)) {
      errors[id] = "This field can't be edited.";
      continue;
    }
    const locale = change.locale as ContentLocale;
    const defaults = DEFAULT_MESSAGES[locale];
    const checked = checkField(change.key, change.value, locale, defaults);
    if (!checked.ok) {
      errors[id] = checked.error;
      continue;
    }

    const isDefault = same(checked.value, getPath(defaults, change.key));
    const hasRow = stored.has(id);

    if (isDefault) {
      // Typed back to exactly the original: that is a reset, not an override
      // that happens to equal the default.
      if (hasRow) {
        toWrite.push({ key: change.key, locale, value: null });
        saved[id] = null;
      }
      continue;
    }
    if (hasRow && same(stored.get(id), checked.value)) continue; // unchanged
    toWrite.push({ key: change.key, locale, value: checked.value });
    saved[id] = checked.value;
  }

  if (Object.keys(errors).length > 0) {
    return {
      ok: false,
      message: "Some fields need attention — nothing was saved.",
      errors,
    };
  }
  if (toWrite.length === 0) return { ok: true, message: "No changes to save.", saved };

  try {
    await saveChanges(toWrite, session.user.email ?? "unknown");
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }
  publish();
  return {
    ok: true,
    message: `Saved ${toWrite.length} change${toWrite.length === 1 ? "" : "s"} — live on the website within a minute.`,
    saved,
  };
}

export async function resetContentAction(input: { key: string; locale: string }): Promise<SaveResult> {
  const session = await requireRole(OWNER_STAFF);
  if (!fieldFor(input.key) || !LOCALES.has(input.locale as ContentLocale)) {
    return { ok: false, message: "This field can't be edited." };
  }
  try {
    await saveChanges(
      [{ key: input.key, locale: input.locale as ContentLocale, value: null }],
      session.user.email ?? "unknown"
    );
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }
  publish();
  return { ok: true, message: "Back to the original text. It will show on the website within a minute.", saved: { [`${input.key}|${input.locale}`]: null } };
}

export interface HistoryEntry {
  id: number;
  value: unknown;
  changedAt: string;
  changedBy: string | null;
}

export async function historyAction(input: {
  key: string;
  locale: string;
}): Promise<{ ok: true; entries: HistoryEntry[] } | { ok: false; message: string }> {
  await requireRole(OWNER_STAFF);
  const known =
    fieldFor(input.key) || input.key === LAYOUT_KEY || input.key === REVIEWS_KEY;
  if (!known) return { ok: false, message: "Unknown field." };
  try {
    return { ok: true, entries: await readHistory(input.key, input.locale as AnyLocale) };
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }
}

// ---------------------------------------------------------------------------
// Homepage section order and visibility
// ---------------------------------------------------------------------------

export async function saveLayoutAction(input: { layout: LayoutEntry[] }): Promise<SaveResult> {
  const session = await requireRole(OWNER_STAFF);
  // Whatever arrives is re-resolved, so a hand-built request can't reorder the
  // pinned banner, invent a section or drop one.
  const layout = resolveLayout(input?.layout);
  try {
    await saveChanges(
      [{ key: LAYOUT_KEY, locale: "*", value: isDefaultLayout(layout) ? null : layout }],
      session.user.email ?? "unknown"
    );
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }
  publish();
  return { ok: true, message: "Homepage updated — live within a minute." };
}

// ---------------------------------------------------------------------------
// Images and videos
// ---------------------------------------------------------------------------

/**
 * A video still, made in the browser from the clip's first frame and sent here
 * to be shrunk and stored. It isn't added to the media library — it is part of a
 * video, not a picture the owner would pick for a dish.
 */
export async function uploadPosterAction(formData: FormData): Promise<
  { ok: true; url: string } | { ok: false; message: string }
> {
  await requireRole(OWNER_STAFF);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "No image received." };
  if (file.size > 6 * 1024 * 1024) return { ok: false, message: "That frame is too large." };

  let data: Buffer;
  try {
    data = await sharp(Buffer.from(await file.arrayBuffer()))
      .rotate()
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84 })
      .toBuffer();
  } catch {
    return { ok: false, message: "Couldn't read that frame as an image." };
  }

  const path = `${POSTER_FOLDER}poster-${randomBytes(6).toString("hex")}.webp`;
  const { error } = await supabaseAdmin()
    .storage.from("media")
    .upload(path, data, { contentType: "image/webp", cacheControl: "31536000" });
  if (error) return { ok: false, message: `Upload failed: ${error.message}` };

  return {
    ok: true,
    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/media/${path}`,
  };
}

export async function saveMediaSlotAction(input: {
  slot: string;
  /** null = go back to the file that ships with the site. */
  value: SlotValue | null;
}): Promise<SaveResult> {
  const session = await requireRole(OWNER_STAFF);
  if (!isSlotId(input.slot)) return { ok: false, message: "Unknown slot." };
  const slot = SLOT_BY_ID.get(input.slot)!;
  const key = mediaKey(input.slot);

  let existing: SlotValue = {};
  try {
    const rows = await listOverrides();
    existing = (rows.find((r) => r.key === key && r.locale === "*")?.value as SlotValue) ?? {};
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }

  let next: SlotValue | null = null;
  if (input.value) {
    const { video, poster, image } = input.value;
    if (slot.kind === "video") {
      if (typeof video !== "string" || !isOwnVideoUrl(video)) {
        return { ok: false, message: "That video didn't come from the uploader." };
      }
      if (typeof poster !== "string" || !isOwnMediaUrl(poster)) {
        return { ok: false, message: "The still frame is missing — upload the video again." };
      }
      next = { video, poster };
    } else {
      if (typeof image !== "string" || !isOwnMediaUrl(image)) {
        return { ok: false, message: "Pick an image from the media library." };
      }
      next = { image };
    }
  }

  try {
    // No history for media: replacing a clip deletes the old file, so an old
    // entry would point at nothing.
    await saveChanges([{ key, locale: "*", value: next }], session.user.email ?? "unknown", {
      history: false,
    });
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }

  // The previous files are orphans now (best effort — never a reason to fail).
  if (existing.video && existing.video !== next?.video) await deleteVideoByUrl(existing.video);
  if (existing.poster && existing.poster !== next?.poster) await deletePosterByUrl(existing.poster);

  publish();
  return {
    ok: true,
    message: next ? "Saved — live on the website within a minute." : "Back to the original — live within a minute.",
  };
}

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

const MAX_REVIEWS = 60;

export async function saveReviewsAction(input: { reviews: Review[] }): Promise<SaveResult> {
  const session = await requireRole(OWNER_STAFF);
  const raw = Array.isArray(input?.reviews) ? input.reviews : [];
  if (raw.length > MAX_REVIEWS) return { ok: false, message: `At most ${MAX_REVIEWS} reviews.` };

  const errors: Record<string, string> = {};
  const clean: Review[] = [];
  raw.forEach((r, i) => {
    const name = String(r?.name ?? "").trim();
    const text = String(r?.text ?? "").replace(/\r\n?/g, "\n").trim();
    const source = String(r?.source ?? "").trim();
    const rating = Math.round(Number(r?.rating));
    if (!name && !text) return; // an untouched blank row
    if (!name) errors[`${i}.name`] = "Add the customer's name.";
    else if (name.length > 60) errors[`${i}.name`] = "Keep the name under 60 characters.";
    if (!text) errors[`${i}.text`] = "Add what they said.";
    else if (text.length > 600) errors[`${i}.text`] = "Keep it under 600 characters.";
    if (!(rating >= 1 && rating <= 5)) errors[`${i}.rating`] = "Choose 1 to 5 stars.";
    if (source.length > 40) errors[`${i}.source`] = "Keep the source under 40 characters.";
    if (/marfah/i.test(`${name} ${text} ${source}`)) {
      errors[`${i}.text`] = "The company's legal name only appears on the Privacy Policy and Terms.";
    }
    clean.push({ name, text, rating: rating as Review["rating"], ...(source ? { source } : {}) });
  });

  if (Object.keys(errors).length > 0) {
    return { ok: false, message: "Some reviews need attention — nothing was saved.", errors };
  }

  try {
    await saveChanges([{ key: REVIEWS_KEY, locale: "*", value: clean }], session.user.email ?? "unknown");
  } catch (error) {
    return { ok: false, message: setupMessage(error) };
  }
  publish();
  return {
    ok: true,
    message: clean.length
      ? `Saved ${clean.length} review${clean.length === 1 ? "" : "s"} — live within a minute.`
      : "All reviews removed — the Reviews page goes back to its empty state.",
  };
}
