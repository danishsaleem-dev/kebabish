import { isValidOrderToken } from "@/lib/order-token";
import { loadCreditNoteData } from "@/lib/invoice/data";
import { buildCreditNotePdf } from "@/lib/invoice/pdf";

export const dynamic = "force-dynamic";

/**
 * A credit note PDF for one refund. Guarded exactly like the invoice: the same
 * signed order token, and a wrong token, an unknown order and an unknown credit
 * note number are all the same plain 404. Carries only what the customer may
 * see — never the internal note.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const number = url.searchParams.get("n") ?? "";
  const notFound = () => new Response("Not found", { status: 404 });

  if (!ref || !number || !isValidOrderToken(ref, token)) return notFound();

  const data = await loadCreditNoteData(ref, number);
  if (!data) return notFound();

  const pdf = await buildCreditNotePdf(data);
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${number}.pdf"`,
      "cache-control": "private, no-store",
    },
  });
}
