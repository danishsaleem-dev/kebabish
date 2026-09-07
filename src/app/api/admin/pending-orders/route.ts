import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPendingOrders } from "@/lib/admin/orders-data";
import { formatMoney } from "@/lib/admin/units";

export const dynamic = "force-dynamic";

/**
 * Polled every few seconds by NewOrderAlert (AdminShellClient) to drive the
 * new-order popup + sound. Deliberately just a GET, not a subscription —
 * this is a single kitchen's order volume, polling is simpler than wiring
 * up Supabase Realtime for it.
 */
export async function GET() {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager") {
    return NextResponse.json({ orders: [] }, { status: 401 });
  }

  const pending = await listPendingOrders();

  return NextResponse.json({
    orders: pending.map((o) => ({
      id: o.id,
      reference: o.reference,
      customerName: o.customerName,
      town: o.town,
      placedAt: o.placedAt,
      total: formatMoney(o.total),
      itemSummary: o.lines.map((l) => `${l.quantity}× ${l.baseName}`).join(", "),
    })),
  });
}
