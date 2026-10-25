import { NextResponse } from "next/server";
import { escalateUnacceptedOrders, expireStaleOrders } from "@/lib/orders";
import { purgeUnusedAccounts } from "@/lib/customers/accounts";

export const dynamic = "force-dynamic";

/**
 * The once-a-minute chores: hand back slots held by abandoned checkouts and
 * email the kitchen about an order nobody has accepted.
 *
 * Both also run lazily from the routes customers and the admin screen hit,
 * but that only works while somebody is looking at the site. This endpoint
 * lets something external — Vercel Cron on a plan that allows per-minute
 * schedules, or a free pinger such as cron-job.org — cover the quiet hours.
 *
 * Protected by `Authorization: Bearer $CRON_SECRET` (the header Vercel Cron
 * sends automatically). With no CRON_SECRET set it refuses everything
 * rather than being open to the world.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }

  // The sweeps are independent. Also clears accounts made at checkout that nobody ever
  // confirmed (no password after 90 days) — their orders are kept.
  const [, , removedAccounts] = await Promise.all([
    expireStaleOrders(),
    escalateUnacceptedOrders(),
    purgeUnusedAccounts().catch((error) => {
      console.error("[housekeeping] could not clear unused accounts:", error);
      return 0;
    }),
  ]);
  return NextResponse.json({ ok: true, removedAccounts });
}
