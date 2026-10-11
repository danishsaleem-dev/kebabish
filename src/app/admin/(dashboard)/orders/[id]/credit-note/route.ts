import { auth } from "@/lib/auth";
import { getOrderSummaryById } from "@/lib/orders";
import { loadCreditNoteData } from "@/lib/invoice/data";
import { buildCreditNotePdf } from "@/lib/invoice/pdf";

export const dynamic = "force-dynamic";

/** A credit note for staff. A route handler, so the role check here is the only guard. */
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
  const url = new URL(request.url);
  const number = url.searchParams.get("n") ?? "";
  const order = await getOrderSummaryById(id);
  if (!order || !number) return new Response("Not found", { status: 404 });

  const data = await loadCreditNoteData(order.reference, number);
  if (!data) return new Response("Credit note not found", { status: 404 });

  const pdf = await buildCreditNotePdf(data);
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
