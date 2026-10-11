import { isValidOrderToken } from "@/lib/order-token";
import { loadInvoiceData } from "@/lib/invoice/data";
import { buildInvoicePdf } from "@/lib/invoice/pdf";

export const dynamic = "force-dynamic";

/**
 * A customer's invoice as a PDF. Guarded by the same signed token as their
 * order page: the reference alone is guessable, and an invoice carries a name
 * and an address. A wrong or missing token gets the same plain 404 as an order
 * that doesn't exist, so it can't be used to find out which references are real.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const ref = url.searchParams.get("ref") ?? "";
  const token = url.searchParams.get("t") ?? "";
  const notFound = () => new Response("Not found", { status: 404 });

  if (!ref || !isValidOrderToken(ref, token)) return notFound();

  const data = await loadInvoiceData(ref);
  if (!data) return notFound();

  const pdf = await buildInvoicePdf(data);
  return new Response(Buffer.from(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${url.searchParams.get("download") ? "attachment" : "inline"}; filename="${data.invoiceNumber}.pdf"`,
      // Personal data — never cached anywhere shared.
      "cache-control": "private, no-store",
    },
  });
}
