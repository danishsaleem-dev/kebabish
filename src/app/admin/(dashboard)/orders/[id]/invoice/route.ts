import { auth } from "@/lib/auth";
import { getOrderSummaryById } from "@/lib/orders";
import { loadInvoiceData } from "@/lib/invoice/data";
import { buildInvoicePdf } from "@/lib/invoice/pdf";

export const dynamic = "force-dynamic";

/**
 * The same invoice the customer gets, for staff — chiefly so an order entered
 * by phone with no email address can still have its invoice sent by hand (over
 * WhatsApp, say). A route handler, so nothing guards it but the role check here.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager") {
    return new Response("Not authorised", { status: 401 });
  }

  const { id } = await params;
  const order = await getOrderSummaryById(id);
  if (!order) return new Response("Order not found", { status: 404 });

  const data = await loadInvoiceData(order.reference);
  if (!data) {
    return new Response("There is no invoice for this order yet — it hasn't been paid.", { status: 404 });
  }

  const pdf = await buildInvoicePdf(data);
  const download = new URL(request.url).searchParams.get("download");
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${data.invoiceNumber}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
