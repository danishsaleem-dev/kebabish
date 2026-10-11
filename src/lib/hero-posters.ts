/**
 * Still frames taken from the two hero clips, one each, so the placeholder is
 * a frame of the video rather than an unrelated photo. Regenerate alongside
 * any new footage:
 *
 *   ffmpeg -ss 8 -i public/video/hero-web.mp4 -frames:v 1 -q:v 3 out.jpg
 *
 * The two differ in shape as well as content (the web clip is 16:9, the mobile
 * one is vertical) — a landscape still stretched over a phone screen is both
 * cropped and soft.
 *
 * Deliberately its own module, with no Node imports: `hero-video.ts` reads the
 * filesystem to check which clips exist, so a Client Component can't import
 * from it. These are plain strings, safe on either side.
 */
export const HERO_POSTER_WEB = "/images/hero-poster.jpg";
export const HERO_POSTER_MOBILE = "/images/hero-poster-mobile.jpg";
