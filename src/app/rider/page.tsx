import Image from "next/image";
import { LogOut, MapPin, Phone } from "lucide-react";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/logout-action";
import { listOrdersForRider } from "@/lib/admin/orders-data";
import { formatMoney } from "@/lib/admin/units";
import Card from "@/components/admin/ui/Card";
import OrderStatusPill from "@/components/admin/OrderStatusPill";
import OrderStatusControl from "@/components/admin/OrderStatusControl";

export const dynamic = "force-dynamic";

export default async function RiderPage() {
  const session = await auth();
  const user = session!.user;
  const orders = await listOrdersForRider(user.id);

  const active = orders.filter((o) => o.status !== "delivered" && o.status !== "cancelled");
  const done = orders.filter((o) => o.status === "delivered" || o.status === "cancelled");

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
                      <p className="font-display text-sm font-semibold text-heading">
                        {formatMoney(order.total)}
                      </p>
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

        {done.length > 0 && (
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Delivered
            </h2>
            <div className="mt-3 space-y-2">
              {done.map((order) => (
                <Card key={order.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-heading">{order.reference}</p>
                    <p className="text-xs text-muted">{order.town}</p>
                  </div>
                  <OrderStatusPill status={order.status} />
                </Card>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
