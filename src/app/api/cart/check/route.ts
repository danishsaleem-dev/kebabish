import { NextResponse } from "next/server";
import { inspectCart } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Public, read-only. The cart page asks "is everything in my basket still on
 * the menu?" and gets a status per line. It reveals nothing a visitor can't
 * already see on the menu (availability and current prices), and it never
 * changes anything.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const lines = (body as { lines?: unknown })?.lines;
  if (!Array.isArray(lines) || lines.length > 50) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  const clean = lines.map((l) => {
    const line = l as { slug?: unknown; options?: unknown };
    const options = Array.isArray(line.options) ? line.options : [];
    return {
      slug: typeof line.slug === "string" ? line.slug : "",
      options: options
        .filter(
          (o): o is { groupId: string; optionId: string } =>
            typeof o?.groupId === "string" && typeof o?.optionId === "string"
        )
        .map((o) => ({ groupId: o.groupId, optionId: o.optionId })),
    };
  });

  return NextResponse.json({ results: await inspectCart(clean) });
}
