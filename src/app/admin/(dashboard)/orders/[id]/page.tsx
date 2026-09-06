import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Bike,
  Clock,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  ShoppingBag,
  User,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import OrderStatusPill from "@/components/admin/OrderStatusPill";
import PrintButton from "@/components/admin/ui/PrintButton";
import { formatMoney } from "@/lib/admin/units";
import { getOrder, getCustomer, listOrders } from "@/lib/admin/orders-data";
import { ORDER_STATUS_LABELS } from "@/lib/admin/order-types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  return { title: order?.reference ?? "Order" };
}

/** Timeline stages an order moves through, in order. */
const STAGES = ["new", "preparing", "on_the_way", "delivered"] as const;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(id);
  if (!order) notFound();

  const [customer, allOrders] = await Promise.all([
    order.customerId ? getCustomer(order.customerId) : Promise.resolve(null),
    listOrders(),
  ]);
  const history = order.customerId
    ? allOrders.filter((o) => o.customerId === order.customerId)
    : [];

  const placed = new Date(order.placedAt);
  const cancelled = order.status === "cancelled";
  const reachedIndex = STAGES.indexOf(order.status as (typeof STAGES)[number]);

  return (
    <AdminShell title={order.reference}>
      <div className="space-y-4 sm:space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading print:hidden"
          >
            <ArrowLeft size={16} />
            Back to orders
          </Link>
          <PrintButton />
        </div>

        {/* header */}
        <Card>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-2xl font-semibold text-heading">
                  {order.reference}
                </h2>
                <OrderStatusPill status={order.status} />
              </div>
              <p className="mt-1.5 flex items-center gap-1.5 text-sm text-muted">
                <Clock size={14} />
                {placed.toLocaleString("en-GB", {
                  weekday: "short",
                  day: "numeric",
                  month: "long",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
            </div>

            <div className="text-right">
              <p className="text-sm text-muted">Order total</p>
              <p className="font-display text-3xl font-semibold text-heading">
                {formatMoney(order.total)}
              </p>
            </div>
          </div>

          {/* progress */}
          <div className="mt-6">
            {cancelled ? (
              <p className="rounded-xl bg-danger-soft px-4 py-3 text-sm font-medium text-danger">
                This order was cancelled.
              </p>
            ) : (
              <ol className="flex items-center gap-2">
                {STAGES.map((stage, i) => {
                  const done = i <= reachedIndex;
                  return (
                    <li key={stage} className="flex flex-1 items-center gap-2">
                      <div className="flex-1">
                        <div
                          className={`h-1.5 rounded-full transition-colors ${
                            done ? "bg-ember-600" : "bg-canvas"
                          }`}
                        />
                        <p
                          className={`mt-2 text-xs ${
                            done ? "font-semibold text-heading" : "text-faint"
                          }`}
                        >
                          {ORDER_STATUS_LABELS[stage]}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </div>
        </Card>

        <div className="grid gap-4 sm:gap-6 xl:grid-cols-[1.4fr_1fr]">
          {/* items */}
          <div className="space-y-4 sm:space-y-6">
            <Card padded={false}>
              <div className="p-5 sm:p-6">
                <CardHeader
                  title="Items"
                  subtitle={`${order.lines.reduce((n, l) => n + l.quantity, 0)} items in this order`}
                />
              </div>
              <ul className="divide-y divide-hairline border-t border-hairline">
                {order.lines.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-4 px-5 py-4 sm:px-6"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-canvas font-display text-sm font-semibold text-heading">
                        {line.quantity}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-heading">
                          {line.name}
                        </p>
                        <p className="text-xs text-muted">
                          {formatMoney(line.unitPrice)} each
                        </p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-semibold text-heading">
                      {formatMoney(line.quantity * line.unitPrice)}
                    </p>
                  </li>
                ))}
              </ul>

              <dl className="space-y-2 border-t border-hairline p-5 text-sm sm:p-6">
                <div className="flex justify-between">
                  <dt className="text-muted">Subtotal</dt>
                  <dd className="text-heading">{formatMoney(order.subtotal)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted">Delivery</dt>
                  <dd className="text-heading">
                    {order.deliveryFee ? formatMoney(order.deliveryFee) : "Free"}
                  </dd>
                </div>
                <div className="flex justify-between border-t border-hairline pt-2">
                  <dt className="font-semibold text-heading">Total</dt>
                  <dd className="font-display text-lg font-semibold text-heading">
                    {formatMoney(order.total)}
                  </dd>
                </div>
              </dl>
            </Card>

            {order.note && (
              <Card className="border-warn/30 bg-warn-soft">
                <p className="text-xs font-semibold uppercase tracking-wide text-warn">
                  Customer note
                </p>
                <p className="mt-1.5 text-sm text-warn">{order.note}</p>
              </Card>
            )}
          </div>

          {/* customer + fulfilment */}
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader title="Customer" />
              <div className="mt-4 flex items-center gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-ember-600 font-display text-sm font-semibold text-cream-50">
                  {order.customerName.charAt(0)}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-heading">
                    {order.customerName}
                  </p>
                  <p className="text-xs text-muted">
                    {history.length} order{history.length === 1 ? "" : "s"} all
                    time
                  </p>
                </div>
              </div>

              <ul className="mt-4 space-y-2 text-sm">
                <li className="flex items-center gap-2 text-body-text">
                  <Phone size={14} className="shrink-0 text-faint" />
                  {order.phone}
                </li>
                {customer && (
                  <li className="flex items-center gap-2 text-body-text">
                    <Mail size={14} className="shrink-0 text-faint" />
                    <span className="truncate">{customer.email}</span>
                  </li>
                )}
              </ul>

              {customer && (
                <Link
                  href={`/admin/customers/${customer.id}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
                >
                  <User size={15} />
                  View customer
                </Link>
              )}
            </Card>

            <Card>
              <CardHeader title="Fulfilment" />
              <ul className="mt-4 space-y-3 text-sm">
                <li className="flex items-center gap-2 text-body-text">
                  {order.fulfilment === "delivery" ? (
                    <Bike size={15} className="shrink-0 text-faint" />
                  ) : (
                    <ShoppingBag size={15} className="shrink-0 text-faint" />
                  )}
                  {order.fulfilment === "delivery" ? "Delivery" : "Takeaway"}
                </li>
                <li className="flex items-center gap-2 text-body-text">
                  {order.channel === "whatsapp" ? (
                    <MessageCircle size={15} className="shrink-0 text-success" />
                  ) : (
                    <Globe size={15} className="shrink-0 text-ember-600" />
                  )}
                  Ordered via{" "}
                  {order.channel === "whatsapp" ? "WhatsApp" : "the website"}
                </li>
                {order.fulfilment === "delivery" && (
                  <li className="flex items-start gap-2 text-body-text">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-faint" />
                    {order.address}
                  </li>
                )}
              </ul>
            </Card>
          </div>
        </div>
      </div>
    </AdminShell>
  );
}
