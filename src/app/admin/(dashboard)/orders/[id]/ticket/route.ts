import { auth } from "@/lib/auth";
import { getOrder } from "@/lib/admin/orders-data";
import { formatEuro } from "@/lib/money";
import { PAYMENT_METHOD_LABELS, isFutureDelivery } from "@/lib/admin/order-types";

export const dynamic = "force-dynamic";

const esc = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/**
 * The ticket/receipt that comes out of the kitchen's thermal printer — what goes on
 * the pass and on the bag, as opposed to the customer invoice. A standalone
 * document (not a page inside the admin shell) so it prints cleanly at 80 mm:
 * big order number, the delivery day and slot, every item with its extras, the
 * customer's note in a box so it can't be missed, who it is for and where it goes,
 * and whether the rider has to collect money. No prices for the dishes and no
 * email — the only amount printed is the one a rider must collect.
 *
 * `?auto=1` is the kitchen board printing it by itself when an order is accepted:
 * it loads in a hidden frame, prints and shows no button.
 *
 * A route handler rather than a page, so it has no layout around it, and
 * the role check is done here by hand: nothing else guards a route handler.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  const role = session?.user.role;
  if (role !== "owner" && role !== "staff" && role !== "manager" && role !== "kitchen") {
    return new Response("Not authorised", { status: 401 });
  }

  const auto = new URL(request.url).searchParams.get("auto") === "1";

  const { id } = await params;
  const order = await getOrder(id);
  if (!order) return new Response("Order not found", { status: 404 });

  const tz = "Europe/Amsterdam";
  const placed = new Date(order.placedAt).toLocaleString("nl-NL", {
    timeZone: tz,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const day = order.deliveryDate
    ? new Date(`${order.deliveryDate}T12:00:00`).toLocaleDateString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
      })
    : null;
  const slot =
    day && order.deliverySlotStart
      ? `${day}<br/>${esc(order.deliverySlotStart)}–${esc(order.deliverySlotEnd ?? "")}`
      : "No slot chosen";
  const later = isFutureDelivery(order.deliveryDate);

  const items = order.lines
    .map(
      (line) => `
      <li>
        <span class="qty">${line.quantity}×</span>
        <span class="name">${esc(line.name)}</span>
      </li>`
    )
    .join("");

  // The only money the kitchen/rider needs to know about: is there something to collect?
  const settled = order.paymentStatus === "paid" || order.paymentStatus === "refunded";
  const payment = settled
    ? `<div class="pay paid">PAID</div>`
    : order.paymentMethod === "cash"
      ? `<div class="pay due">COLLECT CASH<br/>${esc(formatEuro(order.total))}</div>`
      : `<div class="pay due">NOT PAID YET<br/>${esc(PAYMENT_METHOD_LABELS[order.paymentMethod])} · ${esc(formatEuro(order.total))}</div>`;

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kitchen ticket ${esc(order.reference)}</title>
<style>
  @page { size: 80mm auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; color: #000; width: 72mm; max-width: 100%; margin: 0 auto; padding: 4px; }
  h1 { font-size: 30px; margin: 0; letter-spacing: 0.02em; }
  .meta { font-size: 12px; margin-top: 4px; }
  .later { margin-top: 8px; border: 3px solid #000; padding: 5px; text-align: center; font-size: 15px; font-weight: bold; letter-spacing: 0.04em; }
  .slot { font-size: 18px; font-weight: bold; margin: 10px 0; padding: 8px 0; border-top: 2px solid #000; border-bottom: 2px solid #000; }
  ul { list-style: none; padding: 0; margin: 0; }
  li { display: flex; gap: 8px; font-size: 18px; padding: 7px 0; border-bottom: 1px dashed #999; }
  .qty { font-weight: bold; min-width: 36px; }
  .note { margin-top: 12px; border: 3px solid #000; padding: 8px; font-size: 16px; font-weight: bold; }
  .note small { display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 3px; }
  .who { margin-top: 12px; font-size: 15px; line-height: 1.35; }
  .who b { font-size: 17px; }
  .pay { margin-top: 12px; padding: 7px; text-align: center; font-size: 17px; font-weight: bold; border: 2px solid #000; }
  .pay.due { border-width: 4px; }
  .rider { margin-top: 8px; font-size: 13px; }
  .foot { margin-top: 12px; font-size: 11px; color: #444; }
  .noprint { margin: 14px 0; }
  button { font-size: 15px; padding: 10px 16px; }
  @media print { .noprint { display: none; } }
</style>
</head>
<body>
  <h1>${esc(order.reference)}</h1>
  <div class="meta">Ordered ${esc(placed)} · ${order.lines.reduce((n, l) => n + l.quantity, 0)} items</div>
  ${later ? `<div class="later">FOR LATER — DO NOT START YET</div>` : ""}
  <div class="slot">Deliver:<br/>${slot}</div>
  <ul>${items}</ul>
  ${
    order.note
      ? `<div class="note"><small>Customer note — check allergies</small>${esc(order.note)}</div>`
      : ""
  }
  <div class="who">
    <b>${esc(order.customerName)}</b><br/>
    Tel ${esc(order.phone)}<br/>
    ${esc(order.address)}
  </div>
  ${payment}
  ${order.assignedRiderName ? `<div class="rider">Rider: ${esc(order.assignedRiderName)}</div>` : ""}
  <div class="foot">Kebabish kitchen ticket</div>
  ${auto ? "" : `<div class="noprint"><button onclick="window.print()">Print</button></div>`}
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
