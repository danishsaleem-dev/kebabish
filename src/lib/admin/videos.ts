import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { VIDEO_BUCKET } from "@/lib/video-config";

/** Everything stored in the videos bucket has this public URL prefix. */
function prefix(): string {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${VIDEO_BUCKET}/`;
}

/**
 * Only URLs from our own bucket are accepted as a dish's video — nothing
 * else is ever offered by the uploader, so anything different is a
 * hand-edited form post, and we'd rather refuse it than embed it.
 */
export function isOwnVideoUrl(url: string): boolean {
  return url.startsWith(prefix());
}

/**
 * Best-effort removal of an object we no longer reference. Never throws:
 * the dish record is the source of truth, and an orphaned file is only
 * wasted storage, not a reason to fail a save or a delete.
 */
export async function deleteVideoByUrl(url: string | null | undefined): Promise<void> {
  if (!url || !isOwnVideoUrl(url)) return;
  const path = decodeURIComponent(url.slice(prefix().length));
  const { error } = await supabaseAdmin().storage.from(VIDEO_BUCKET).remove([path]);
  if (error) console.error("[videos] couldn't remove an unused video:", error.message);
}
