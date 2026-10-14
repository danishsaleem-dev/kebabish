/**
 * Dish-video limits, shared by the admin upload field (client) and the
 * server action that hands out upload URLs. The `videos` bucket itself
 * enforces the same two limits independently, so this is UX and a first
 * line of defence, not the only one.
 */
export const VIDEO_BUCKET = "videos";
export const MAX_VIDEO_MB = 30;
export const MAX_VIDEO_BYTES = MAX_VIDEO_MB * 1024 * 1024;
export const VIDEO_TYPES = ["video/mp4", "video/webm"] as const;

/**
 * The `type` for a `<source>`, from the file's extension. Uploads are mp4 or
 * webm, and a `<source>` that claims the wrong type can be skipped by a browser
 * that trusts it, so it is derived rather than hard-coded as mp4.
 */
export function videoMimeType(src: string): "video/mp4" | "video/webm" {
  return /\.webm(\?|$)/i.test(src) ? "video/webm" : "video/mp4";
}
