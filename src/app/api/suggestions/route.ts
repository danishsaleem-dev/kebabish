import { NextResponse } from "next/server";
import { getSuggestions } from "@/lib/suggestions";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{0,80}$/;

const list = (value: string | null) =>
  (value ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => SLUG.test(s))
    .slice(0, 20);

/**
 * "Often bought with" for the dish page, the basket drawer, checkout and the sold-out
 * popup. Public and read-only: it returns only what the public menu already shows
 * (name, price, photo) for dishes that can be ordered. Slugs are matched against the
 * real menu, so a made-up one just scores nothing; the response may be cached briefly.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locale = searchParams.get("locale") === "en" ? "en" : "nl";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 4, 1), 8);

  try {
    const items = await getSuggestions({
      slugs: list(searchParams.get("slugs")),
      exclude: list(searchParams.get("exclude")),
      locale,
      limit,
    });
    return NextResponse.json(
      { items },
      { headers: { "cache-control": "public, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("[suggestions] failed:", error);
    // A missing suggestion strip must never be a broken page: say there are none.
    return NextResponse.json({ items: [] });
  }
}
