import { NextResponse } from "next/server";
import { getPayment } from "@/lib/mollie";
import { syncPaymentStatus } from "@/lib/orders";

/**
 * Mollie's payment webhook.
 *
 * Mollie posts only an id, never a status — the status is then fetched
 * from the API using our own key. That's the design: the request body
 * can't be forged into marking an order paid, because the truth always
 * comes from an authenticated call back to Mollie.
 */
export async function POST(request: Request) {
  try {
    const form = await request.formData();
    const id = String(form.get("id") ?? "");
    if (!id.startsWith("tr_")) {
      return NextResponse.json({ error: "bad id" }, { status: 400 });
    }

    const payment = await getPayment(id);
    await syncPaymentStatus(payment.id, payment.status);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[mollie] webhook failed:", error);
    // A non-200 makes Mollie retry, which is what we want for a transient
    // failure — better a duplicate sync than a payment we never recorded.
    return NextResponse.json({ error: "webhook failed" }, { status: 500 });
  }
}
