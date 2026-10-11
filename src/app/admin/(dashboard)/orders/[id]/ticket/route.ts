import { auth } from "@/lib/auth";
import { getOrder } from "@/lib/admin/orders-data";

export const dynamic = "force-dynamic";

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The kitchen ticket — what goes on the pass, as opposed to the customer
 * invoice. A standalone document (not a page inside the admin shell) so it
 * prints cleanly on a thermal or A6 printer: big order number, the delivery
 * slot, every item with its extras, and the customer's note in a box so it
 * can't be missed. No prices and no address — the kitchen doesn't need
 * either, and the ticket often ends up taped to a bag.
 *
 * A route handler rather than a page, so it has no layout around it, and
 * the role check is done here by hand: nothing else guards a route handler.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager" && role !== "kitchen") {
    return new Response("Not authorised", { status: 401 });
  }

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return new Response("Order not found", { status: 404 });

  const placed = new Date(order.placedAt).toLocaleTimeString("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  });
  const slot =
    order.deliveryDate && order.deliverySlotStart
      ? `${new Date(`${order.deliveryDate}T00:00:00`).toLocaleDateString("nl-NL", {
          weekday: "long",
          day: "numeric",
          month: "long",
        })} ${order.deliverySlotStart}–${order.deliverySlotEnd}`
      : "No slot chosen";

  const items = order.lines
    .map(
      (line) => `
      <li>
        <span class="qty">${line.quantity}×</span>
        <span class="name">${esc(line.name)}</span>
      </li>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kitchen ticket ${esc(order.reference)}</title>
<style>
  @page { margin: 6mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; max-width: 80mm; margin: 0 auto; padding: 8px; }
  h1 { font-size: 30px; margin: 0; letter-spacing: 0.02em; }
  .meta { font-size: 13px; margin-top: 4px; }
  .slot { font-size: 18px; font-weight: bold; margin: 10px 0; padding: 8px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; gap: 8px; font-size: 18px; padding: 7px 0; border-bottom: 1px dashed #999; }
  .qty { font-weight: bold; min-width: 36px; }
  .note { margin-top: 12px; border: 3px solid #000; padding: 8px; font-size: 16px; font-weight: bold; }
  .note small { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .foot { margin-top: 12px; font-size: 11px; color: #444; }
  .noprint { margin: 14px 0; }
  button { font-size: 15px; padding: 10px 16px; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
  <h1>${esc(order.reference)}</h1>
  <div class="meta">Ordered ${placed} · ${order.lines.reduce((n, l) => n + l.quantity, 0)} items</div>
  <div class="slot">Deliver: ${esc(slot)}</div>
  <ul>${items}</ul>
  ${
    order.note
      ? `<div class="note"><small>Customer note — check allergies</small>${esc(order.note)}</div>`
      : ""
  }
  <div class="foot">Kebabish kitchen ticket</div>
  <div class="noprint"><button onclick="window.print()">Print</button></div>
  <script>window.addEventListener("load", function () { window.print(); });</script>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      // The ticket is private order data — never cache it anywhere shared.
      "cache-control": "private, no-store",
    },
  });
}
