import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";

/**
 * Public-URL handling for the `media` bucket (images, and the video posters the
 * content editor makes). The `videos` bucket has the same in lib/admin/videos.ts.
 *
 * A slot is only ever allowed to point at our own bucket: the uploader is the
 * only thing that produces these URLs, so any other value is a hand-edited
 * request, and embedding an arbitrary URL on the public site is exactly what
 * these checks are here to refuse.
 */
const BUCKET = "media";

function prefix(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
}

export function isOwnMediaUrl(url: string): boolean {
  return url.startsWith(prefix());
}

/** Where the editor files the video stills it makes. */
export const POSTER_FOLDER = "posters/";

/**
 * Best-effort removal of a video still nothing points at any more. Never throws.
 *
 * Only ever deletes inside `posters/`. The same bucket also holds the media
 * LIBRARY's images, which a slot may point at (the small story photo is picked
 * from the library) — those have records of their own and must outlive a slot
 * changing its mind.
 */
export async function deletePosterByUrl(url: string | null | undefined): Promise<void> {
  if (!url || !isOwnMediaUrl(url)) return;
  const path = decodeURIComponent(url.slice(prefix().length));
  if (!path.startsWith(POSTER_FOLDER)) return;
  const { error } = await supabaseAdmin().storage.from(BUCKET).remove([path]);
  if (error) console.error("[content] couldn't remove an unused image:", error.message);
}
