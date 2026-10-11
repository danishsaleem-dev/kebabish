/**
 * Still frames shown while a hero clip loads. Each is the clip's **own first
 * frame**, so the still and the video are the same picture and nothing visibly
 * pops when playback starts.
 *
 * That is the point, and it is not cosmetic. These used to be a detailed frame
 * from the end of each clip — a sharp-looking grill shot — which, from a source
 * only 848x478, stretched across a full-width hero looked blocky and blurry, and
 * then the video started on something completely different. The clips open on
 * soft flames over black, which hide low resolution well; a detail shot never
 * can. A poster can only be as sharp as its footage, so cut it from frame 0:
 *
 *   web (16:9):     ffmpeg -ss 0 -i public/video/hero-web.mp4 -frames:v 1 \
 *                     -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:0.5:5:5:0.0" out.png
 *   mobile (9:16):  ffmpeg -ss 0 -i public/video/hero-mobile.mp4 -frames:v 1 out.png
 *
 * then save as JPEG (quality ~90, 4:4:4 so dark gradients don't band). The web
 * poster is 1920x1080 rather than the clip's native 848x478 so the browser is not
 * left to stretch it ~2.3x with a cheap filter. The mobile clip opens on black
 * (it fades up), so its poster is simply black — correct, not a missing image.
 *
 * Deliberately its own module, with no Node imports: `hero-video.ts` reads the
 * filesystem, so a Client Component can't import from it. These are plain
 * strings, safe on either side.
 */
export const HERO_POSTER_WEB = "/images/hero-poster.jpg";
export const HERO_POSTER_MOBILE = "/images/hero-poster-mobile.jpg";
