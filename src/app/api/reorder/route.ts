import { NextResponse } from "next/server";
import { isValidOrderToken } from "@/lib/order-token";
import { buildReorder } from "@/lib/reorder";

export const dynamic = "force-dynamic";

/**
 * "Order this again": a past order's lines, rebuilt against today's menu and prices
 * (see lib/reorder.ts). Guarded by the same token as the order's confirmation page, so
 * only someone holding that link — the customer's own device, their dashboard, their
 * emails — can read an order's contents. A wrong token and an unknown reference are
 * the same plain 404, so the endpoint never confirms that a reference exists.
 *
 * Only dish names, extras and current prices come back — never a name, address or
 * phone number.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  const token = url.searchParams.get("t") ?? undefined;
  const locale = url.searchParams.get("locale") === "en" ? "en" : "nl";

  if (!ref || ref.length > 40 || !isValidOrderToken(ref, token)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const reorder = await buildReorder(ref, locale);
    if (!reorder) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(reorder, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("[reorder] couldn't rebuild the order:", error);
    return NextResponse.json({ error: "Unavailable" }, { status: 503 });
  }
}
