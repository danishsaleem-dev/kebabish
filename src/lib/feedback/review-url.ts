/**
 * The Google review link shown to a happy customer after they send feedback
 * (Settings -> Feedback). Empty until the owner pastes one in — we have no
 * Google Business profile URL of our own to assume, and a guessed one would
 * send happy customers to the wrong place.
 *
 * Only a Google-hosted address is accepted. The value is rendered as a link on a
 * page customers trust, so a mistyped or hostile entry in settings must not be
 * able to point them anywhere else. `g.page`, `goo.gl` and `maps.app.goo.gl` are
 * the short forms Google itself hands out for "Ask for reviews".
 */
const ALLOWED_HOSTS = [/(^|\.)google\.com$/, /(^|\.)google\.nl$/, /^g\.page$/, /(^|\.)goo\.gl$/, /^share\.google$/];

export function validReviewUrl(value: string | undefined | null): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    if (url.protocol !== "https:") return null;
    return ALLOWED_HOSTS.some((re) => re.test(url.hostname)) ? url.toString() : null;
  } catch {
    return null;
  }
}
