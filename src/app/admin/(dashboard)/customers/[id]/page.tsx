import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  ChevronRight,
  Globe,
  Heart,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
} from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import OrderStatusPill from "@/components/admin/OrderStatusPill";
import { formatMoney } from "@/lib/admin/units";
import { getCustomer, listOrders } from "@/lib/admin/orders-data";
import { CUSTOMER_STATUS_LABELS } from "@/lib/admin/order-types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomer(id);
  return { title: customer?.name ?? "Customer" };
}

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [customer, allOrders] = await Promise.all([
    getCustomer(id),
    listOrders(),
  ]);
  if (!customer) notFound();

  const history = allOrders
    .filter((o) => o.customerId === id)
    .sort((a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt));
  const avg = customer.totalSpent / Math.max(1, customer.orderCount);

  const stats = [
    { label: "Total orders", value: String(customer.orderCount) },
    { label: "Lifetime value", value: formatMoney(customer.totalSpent) },
    { label: "Average order", value: formatMoney(avg) },
    {
      label: "Customer since",
      value: new Date(customer.joinedAt).toLocaleDateString("en-GB", {
        month: "short",
        year: "numeric",
      }),
    },
  ];

  return (
    <AdminShell title={customer.name}>
      <div className="space-y-4 sm:space-y-6">
        <Link
          href="/admin/customers"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to customers
        </Link>

        <Card>
          <div className="flex flex-wrap items-start gap-4">
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ember-600 font-display text-xl font-semibold text-cream-50">
              {customer.name.charAt(0)}
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="font-display text-2xl font-semibold text-heading">
                  {customer.name}
                </h2>
                <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-semibold text-muted">
                  {CUSTOMER_STATUS_LABELS[customer.status]}
                </span>
              </div>

              <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-body-text">
                <li className="flex items-center gap-1.5">
                  <Phone size={14} className="text-faint" />
                  {customer.phone}
                </li>
                <li className="flex items-center gap-1.5">
                  <Mail size={14} className="text-faint" />
                  {customer.email}
                </li>
                {customer.address !== "—" && (
                  <li className="flex items-center gap-1.5">
                    <MapPin size={14} className="text-faint" />
                    {customer.address}
                  </li>
                )}
                <li className="flex items-center gap-1.5">
                  {customer.preferredChannel === "whatsapp" ? (
                    <MessageCircle size={14} className="text-success" />
                  ) : (
                    <Globe size={14} className="text-ember-600" />
                  )}
                  Prefers{" "}
                  {customer.preferredChannel === "whatsapp"
                    ? "WhatsApp"
                    : "the website"}
                </li>
                {customer.favouriteDish && (
                  <li className="flex items-center gap-1.5">
                    <Heart size={14} className="text-faint" />
                    Usually orders {customer.favouriteDish}
                  </li>
                )}
              </ul>
            </div>
          </div>
        </Card>

        <Card padded={false}>
          <div className="grid divide-y divide-hairline sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            {stats.map((stat) => (
              <div key={stat.label} className="p-5">
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-1.5 font-display text-2xl font-semibold text-heading">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Order history"
              subtitle={
                history.length
                  ? `${history.length} order${history.length === 1 ? "" : "s"}`
                  : "No orders yet"
              }
            />
          </div>

          {history.length > 0 && (
            <ul className="divide-y divide-hairline border-t border-hairline">
              {history.map((order) => (
                <li key={order.id}>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-canvas/60 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-heading">
                        {order.reference}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <CalendarDays size={12} />
                        {new Date(order.placedAt).toLocaleString("en-GB", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </p>
                    </div>

                    <p className="hidden max-w-56 truncate text-sm text-muted md:block">
                      {order.lines.map((l) => `${l.quantity}× ${l.name}`).join(", ")}
                    </p>

                    <p className="shrink-0 text-sm font-semibold text-heading">
                      {formatMoney(order.total)}
                    </p>

                    <div className="hidden shrink-0 sm:block">
                      <OrderStatusPill status={order.status} />
                    </div>

                    <ChevronRight size={18} className="shrink-0 text-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
