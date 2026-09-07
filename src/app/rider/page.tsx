import Image from "next/image";
import { redirect } from "next/navigation";
import { LogOut, MapPin, Phone } from "lucide-react";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/logout-action";
import { listOrdersForRider } from "@/lib/admin/orders-data";
import Card from "@/components/admin/ui/Card";
import OrderStatusPill from "@/components/admin/OrderStatusPill";
import OrderStatusControl from "@/components/admin/OrderStatusControl";
import { PAYMENT_STATUS_LABELS, type PaymentStatus } from "@/lib/admin/order-types";

export const dynamic = "force-dynamic";

const PAYMENT_TONE: Record<PaymentStatus, string> = {
  open: "text-warn",
  paid: "text-success",
  failed: "text-danger",
  expired: "text-danger",
  canceled: "text-danger",
  refunded: "text-muted",
};

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default async function RiderPage() {
  const session = await auth();
  // The layout above already redirects an unauthenticated request — this is
  // a defensive fallback for the rare case this page renders before that
  // redirect lands (seen in dev under Turbopack's parallel layout/page
  // rendering), so a null session can't crash the page instead.
  if (!session?.user) redirect("/login");
  const user = session.user;
  const orders = await listOrdersForRider(user.id);

  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  // Newest delivery first — this is the rider's own timeline of what they've
  // actually delivered, so a cancelled order (never delivered) doesn't belong.
  const delivered = orders
    .filter((o) => o.status === "delivered")
    .sort((a, b) => Date.parse(b.deliveredAt ?? b.placedAt) - Date.parse(a.deliveredAt ?? a.placedAt));

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-panel">
        <div className="mx-auto flex h-16 max-w-2xl items-center justify-between px-4 sm:px-6">
          <Image
            src="/logo/Kebabish-light.png"
            alt="Kebabish"
            width={300}
            height={225}
            priority
            className="h-9 w-auto"
          />
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-canvas hover:text-danger"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-heading">
            {user.name || user.email}
          </h1>
          <p className="mt-1 text-sm text-muted">Your deliveries.</p>
        </div>

        <div>
          <h2 className="font-display text-lg font-semibold text-heading">
            To deliver
          </h2>

          {active.length === 0 ? (
            <Card className="mt-3 py-10 text-center text-sm text-muted">
              Nothing assigned to you right now.
            </Card>
          ) : (
            <div className="mt-3 space-y-3">
              {active.map((order) => (
                <Card key={order.id} padded={false}>
                  <div className="flex flex-wrap items-start justify-between gap-3 p-5">
                    <div>
                      <p className="font-display text-sm font-semibold text-heading">
                        {order.reference}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <Phone size={12} className="shrink-0" />
                        {order.phone}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusPill status={order.status} />
                      <span className={`text-xs font-semibold ${PAYMENT_TONE[order.paymentStatus]}`}>
                        {PAYMENT_STATUS_LABELS[order.paymentStatus]}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 border-t border-hairline px-5 py-4 text-sm text-body-text">
                    <MapPin size={15} className="mt-0.5 shrink-0 text-faint" />
                    {order.address}
                  </div>

                  <div className="flex justify-end border-t border-hairline p-4">
                    <OrderStatusControl orderId={order.id} status={order.status} />
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        {delivered.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Your delivery timeline
            </h2>

            <ol className="mt-3 space-y-0 border-l-2 border-hairline pl-4">
              {delivered.map((order) => (
                <li key={order.id} className="relative pb-4 last:pb-0">
                  <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-success" />
                  <Card className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-heading">
                        {order.reference} · {order.town}
                      </p>
                      <p className="text-xs text-muted">
                        Delivered {order.deliveredAt ? dateTime(order.deliveredAt) : "—"}
                      </p>
                    </div>
                    <OrderStatusPill status={order.status} />
                  </Card>
                </li>
              ))}
            </ol>
          </div>
        )}
      </main>
    </div>
  );
}
