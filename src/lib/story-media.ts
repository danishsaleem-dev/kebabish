import { existsSync } from "node:fs";
import path from "node:path";

/**
 * The clip in the "Ons verhaal" story section — on the homepage and on /about,
 * which share one component (`shared/StoryFrame.tsx`). It is its own file
 * rather than a reuse of the hero's mobile clip so the two can be changed
 * independently, which is what Danish asked for.
 *
 * Checked at build time like the hero's: if the file is ever missing, the
 * section simply shows its poster still instead of a `<video>` that 404s.
 * The poster is a frame of the clip itself, so the two look the same.
 *
 * Footage must be H.264 (see "Footage must be H.264" in CLAUDE.md) — an HEVC
 * file will not play in Chrome or Firefox on most phones.
 */
export const STORY_VIDEO_PATH = "public/video/about-video.mp4";
export const STORY_VIDEO_SRC = "/video/about-video.mp4";
export const STORY_POSTER = "/images/about-poster.jpg";

export function storyVideoAvailable(): boolean {
  return existsSync(path.join(process.cwd(), STORY_VIDEO_PATH));
}
