import { existsSync } from "node:fs";
import path from "node:path";

/**
 * The hero background video is supplied by the client and checked for at
 * build time, falling back to the poster still if it's missing rather than
 * shipping a <video> that 404s.
 *
 * Two variants, not one: a vertically-framed clip for phones and a
 * widescreen one for larger screens, swapped via CSS breakpoints in
 * Hero.tsx rather than loading both and hiding one — a hidden <video>
 * still downloads its poster/first frame otherwise.
 */
export const HERO_VIDEO_WEB_PATH = "public/video/hero-web.mp4";
export const HERO_VIDEO_MOBILE_PATH = "public/video/hero-mobile.mp4";

export interface HeroVideoAvailability {
  web: boolean;
  mobile: boolean;
}

export function getHeroVideoAvailability(): HeroVideoAvailability {
  return {
    web: existsSync(path.join(process.cwd(), HERO_VIDEO_WEB_PATH)),
    mobile: existsSync(path.join(process.cwd(), HERO_VIDEO_MOBILE_PATH)),
  };
}
