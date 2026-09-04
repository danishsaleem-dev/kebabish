import { existsSync } from "node:fs";
import path from "node:path";

/**
 * The hero background video is supplied by the client and isn't in the repo
 * yet. Rather than shipping a <video> that 404s, the hero checks for the file
 * at build time and falls back to the poster still. Dropping
 * `public/video/hero.mp4` in and rebuilding is all it takes to switch on.
 */
export const HERO_VIDEO_PATH = "public/video/hero.mp4";

export function hasHeroVideo(): boolean {
  return existsSync(path.join(process.cwd(), HERO_VIDEO_PATH));
}
