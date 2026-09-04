/**
 * "Coming soon" gate — shared by proxy.ts, robots.ts and sitemap.ts so all
 * three agree on whether the real site is currently public.
 *
 * Toggling this is the entire launch switch: set SITE_COMING_SOON=false (or
 * unset it) in the deployment's env vars and redeploy to go live. No code
 * change needed either direction.
 */
export function isComingSoonEnabled(): boolean {
  return process.env.SITE_COMING_SOON === "true";
}

export const PREVIEW_COOKIE = "kebabish_preview";
export const PREVIEW_QUERY_PARAM = "preview";
