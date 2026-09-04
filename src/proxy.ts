import { NextResponse, type NextRequest } from "next/server";
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import {
  isComingSoonEnabled,
  PREVIEW_COOKIE,
  PREVIEW_QUERY_PARAM,
} from "@/lib/site-gate";

const intlMiddleware = createMiddleware(routing);

/** `/en/coming-soon` or `/coming-soon` — both count as "already there". */
function isComingSoonPath(pathname: string): boolean {
  const withoutLocale = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  return withoutLocale === "/coming-soon";
}

/** `/en/menu` -> `/en/coming-soon`; `/menu` -> `/coming-soon`. */
function comingSoonUrl(request: NextRequest): URL {
  const prefix = request.nextUrl.pathname.startsWith("/en") ? "/en" : "";
  return new URL(`${prefix}/coming-soon`, request.url);
}

export default function proxy(request: NextRequest) {
  if (!isComingSoonEnabled()) {
    return intlMiddleware(request);
  }

  const { nextUrl } = request;
  const previewToken = nextUrl.searchParams.get(PREVIEW_QUERY_PARAM);
  const secret = process.env.COMING_SOON_PREVIEW_SECRET;

  // A valid special link grants a standing pass: strip the token from the
  // URL (it's not meant to sit in the address bar/history forever) and set
  // a cookie so every later request from this browser skips the gate.
  if (secret && previewToken === secret) {
    const clean = new URL(nextUrl.pathname + nextUrl.search, request.url);
    clean.searchParams.delete(PREVIEW_QUERY_PARAM);

    const response = NextResponse.redirect(clean);
    response.cookies.set(PREVIEW_COOKIE, "granted", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 90, // 90 days
      path: "/",
    });
    return response;
  }

  const hasBypass = request.cookies.get(PREVIEW_COOKIE)?.value === "granted";

  if (hasBypass || isComingSoonPath(nextUrl.pathname)) {
    return intlMiddleware(request);
  }

  return NextResponse.redirect(comingSoonUrl(request), { status: 307 });
}

export const config = {
  // Skip API routes, the admin dashboard, the auth pages, the customer
  // dashboard, static files and Next internals — all locale-independent.
  matcher: [
    "/((?!api|admin|login|signup|dashboard|_next|_vercel|.*\\..*).*)",
  ],
};
