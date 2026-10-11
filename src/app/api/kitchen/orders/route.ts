import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { listKitchenOrders } from "@/lib/admin/orders-data";
import { escalateUnacceptedOrders, expireStaleOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Polled every few seconds by the kitchen board. Deliberately least-privilege:
 * what the cooks need (order number, slot, what to make, the customer's note,
 * first name) and nothing else — no phone number, no address, no totals, no
 * email. The same few seconds' poll doubles as a heartbeat for the chores that
 * have no scheduler (releasing abandoned checkouts, the "nobody accepted this"
 * email), exactly like the admin popup's poll.
 */
export async function GET() {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "kitchen" && role !== "owner" && role !== "staff" && role !== "manager") {
    return NextResponse.json({ orders: [] }, { status: 401 });
  }

  after(() => expireStaleOrders());
  after(() => escalateUnacceptedOrders());

  const orders = await listKitchenOrders();
  return NextResponse.json({
    orders: orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      // First name only — the kitchen needs to call out an order, not contact anyone.
      firstName: o.customerName.trim().split(/\s+/)[0] ?? "",
      status: o.status,
      paymentStatus: o.paymentStatus,
      paymentMethod: o.paymentMethod,
      paidAt: o.paidAt,
      acceptedAt: o.acceptedAt,
      placedAt: o.placedAt,
      deliveryDate: o.deliveryDate,
      slotStart: o.deliverySlotStart,
      slotEnd: o.deliverySlotEnd,
      lines: o.lines.map((l) => ({ quantity: l.quantity, name: l.name })),
      note: o.note ?? null,
    })),
  });
}
