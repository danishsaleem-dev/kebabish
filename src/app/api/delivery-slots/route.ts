import { NextResponse } from "next/server";
import { getSlotAvailability } from "@/lib/delivery-slots-data";
import { weekdayForDateKey } from "@/lib/delivery-slots";

export const dynamic = "force-dynamic";

/**
 * Public — no auth. Live availability for one date, polled by the
 * checkout page's slot picker so a slot that fills up while someone's
 * browsing shows as full without a page reload. Returns only a status per
 * slot (available/full/disabled/past), never the raw booked/max counts —
 * that detail is admin-only (src/lib/delivery-slots-data.ts's
 * `listSlotConfigForDate`, behind the owner/staff-only admin section).
 */
export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date") ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const slots = await getSlotAvailability(date, weekdayForDateKey(date));
  return NextResponse.json({
    slots: slots.map((s) => ({ start: s.start, end: s.end, status: s.status })),
  });
}
