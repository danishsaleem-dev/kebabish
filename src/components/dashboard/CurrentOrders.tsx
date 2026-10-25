import { CalendarClock, ChefHat, ExternalLink, MapPin, PackageCheck, Truck } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import AutoRefresh from "@/components/cart/AutoRefresh";
import { orderAccessToken } from "@/lib/order-token";
import { formatEuro, fromCents } from "@/lib/money";
import type { OrderSummary } from "@/lib/orders";

/**
 * Where the order is right now. Orders that are paid and not yet delivered or cancelled
 * get a live progress bar (the page refreshes itself every 30 seconds while there is one),
 * the delivery time, and a link to the full order page. The order the customer has just
 * placed (`?order=` — they arrive from the payment) is marked "Just placed".
 *
 * Statuses, as the kitchen sets them: a "scheduled" order has been accepted for a later
 * day (it reads as Received until its day), and "ready" is the kitchen's own optional
 * step, which to the customer is still Preparing.
 */
const STEPS = [
  { key: "received", label: "Received", icon: PackageCheck },
  { key: "preparing", label: "Preparing", icon: ChefHat },
  { key: "on_the_way", label: "On the way", icon: Truck },
  { key: "delivered", label: "Delivered", icon: MapPin },
] as const;

function position(status: string): number {
  if (status === "delivered") return 3;
  if (status === "on_the_way") return 2;
  if (status === "preparing" || status === "ready") return 1;
  return 0;
}

export function isCurrentOrder(order: OrderSummary): boolean {
  return order.paymentStatus === "paid" && !["delivered", "cancelled"].includes(order.status);
}

export default function CurrentOrders({
  orders,
  highlight,
}: {
  orders: OrderSummary[];
  highlight?: string;
}) {
  const current = orders.filter(isCurrentOrder);
  if (current.length === 0) return null;

  return (
    <div className="space-y-3">
      <AutoRefresh intervalMs={30_000} />
      {current.map((order) => {
        const at = position(order.status);
        const later = order.status === "scheduled";
        const lang = order.locale === "en" ? "/en" : "";
        const itemSummary = order.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ");
        const when =
          order.deliveryDate && order.deliverySlotStart
            ? `${new Date(`${order.deliveryDate}T00:00:00`).toLocaleDateString("en-GB", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}, ${order.deliverySlotStart}–${order.deliverySlotEnd}`
            : null;

        return (
          <Card key={order.reference} className="border-ember-600/30">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-ember-700">
                  Your order
                  {order.reference === highlight && (
                    <span className="rounded-full bg-ember-600 px-2 py-0.5 text-[0.65rem] font-bold text-cream-50">
                      Just placed
                    </span>
                  )}
                </p>
                <h2 className="mt-0.5 font-display text-lg font-semibold text-heading">{order.reference}</h2>
              </div>
              <p className="font-display text-base font-semibold text-heading">
                {formatEuro(fromCents(order.totalCents))}
              </p>
            </div>

            <ol className="mt-5 grid grid-cols-4 gap-2" aria-label="Order progress">
              {STEPS.map((step, i) => {
                const done = i <= at;
                const now = i === at;
                const Icon = step.icon;
                return (
                  <li key={step.key} className="text-center" aria-current={now ? "step" : undefined}>
                    <span
                      className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                        done ? "bg-ember-600 text-cream-50" : "bg-canvas text-faint"
                      } ${now ? "ring-4 ring-ember-600/20" : ""}`}
                    >
                      <Icon size={18} aria-hidden="true" />
                    </span>
                    <span className={`mt-2 block text-xs ${done ? "font-semibold text-heading" : "text-faint"}`}>
                      {step.label}
                    </span>
                  </li>
                );
              })}
            </ol>

            <p className="mt-5 text-sm text-body-text">
              {later
                ? "Accepted for a later day — we start cooking on the day itself."
                : at === 0
                  ? "We've got your order and the kitchen is picking it up."
                  : at === 1
                    ? "Your food is being prepared."
                    : "Your order is on its way to you."}
            </p>

            {when && (
              <p className="mt-2 flex items-center gap-2 text-sm text-body-text">
                <CalendarClock size={15} aria-hidden="true" className="shrink-0 text-faint" />
                {when}
              </p>
            )}
            <p className="mt-2 text-sm text-muted">{itemSummary}</p>

            <a
              href={`${lang}/checkout/complete?ref=${encodeURIComponent(order.reference)}&t=${orderAccessToken(order.reference)}`}
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ember-700 hover:text-ember-600"
            >
              Order details and invoice
              <ExternalLink size={14} aria-hidden="true" />
            </a>
          </Card>
        );
      })}
    </div>
  );
}
