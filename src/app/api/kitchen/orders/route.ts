import { NextResponse } from "next/server";
import { after } from "next/server";
import { auth } from "@/lib/auth";
import { listKitchenOrders } from "@/lib/admin/orders-data";
import { listRiders } from "@/lib/admin/auth-users";
import { escalateUnacceptedOrders, expireStaleOrders } from "@/lib/orders";

export const dynamic = "force-dynamic";

/**
 * Polled every few seconds by the kitchen board: what to cook, who it is for, where
 * it goes and who is taking it. The kitchen hands orders to riders and sees the
 * customer's phone number and address (so it can ring about an allergy, or tell a
 * rider where to go), but not the email, the payment details or the prices — a cook
 * has no need for them. The same few seconds' poll doubles as a heartbeat for the chores
 * that have no scheduler (releasing abandoned checkouts, the "nobody accepted this"
 * email), exactly like the admin popup's poll.
 */
export async function GET() {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "kitchen" && role !== "owner" && role !== "staff" && role !== "manager") {
    return NextResponse.json({ orders: [], riders: [] }, { status: 401 });
  }

  after(() => expireStaleOrders());
  after(() => escalateUnacceptedOrders());

  const [orders, riders] = await Promise.all([listKitchenOrders(), listRiders()]);
  return NextResponse.json({
    riders: riders.map((r) => ({ id: r.id, name: r.name })),
    orders: orders.map((o) => ({
      id: o.id,
      reference: o.reference,
      customerName: o.customerName,
      firstName: o.customerName.trim().split(/\s+/)[0] ?? "",
      phone: o.phone,
      address: o.address,
      town: o.town,
      assignedRiderId: o.assignedRiderId,
      assignedRiderName: o.assignedRiderName,
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
