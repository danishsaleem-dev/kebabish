import { NextResponse } from "next/server";

/**
 * Receives the "Er ging iets mis" page's report of what broke in a visitor's browser.
 *
 * The site has no error-monitoring service, and a render error that only happens on one
 * customer's phone leaves nothing behind except their screenshot. This writes one line to
 * the server log (Vercel → Logs, search "[client-error]") with the message, the top of the
 * stack, the page and the browser. It stores nothing, takes no personal data (no cart
 * contents, no account) and is deliberately small: lengths are capped and each server
 * instance accepts only a handful a minute, so it can't be used to flood the log.
 */
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
let windowStart = 0;
let seen = 0;

function clip(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max) : "";
}

export async function POST(request: Request) {
  const now = Date.now();
  if (now - windowStart > WINDOW_MS) {
    windowStart = now;
    seen = 0;
  }
  if (++seen > MAX_PER_WINDOW) return new NextResponse(null, { status: 204 });

  let body: Record<string, unknown> = {};
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  console.error(
    "[client-error]",
    JSON.stringify({
      message: clip(body.message, 300),
      name: clip(body.name, 60),
      digest: clip(body.digest, 40),
      path: clip(body.path, 200),
      stack: clip(body.stack, 1500),
      cart: clip(body.cart, 60),
      userAgent: clip(request.headers.get("user-agent"), 200),
    })
  );
  return new NextResponse(null, { status: 204 });
}
