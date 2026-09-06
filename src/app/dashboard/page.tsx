import Image from "next/image";
import Link from "next/link";
import { LogOut, Mail, MapPin, Phone, ShoppingBag, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/logout-action";
import { listCustomerOrders } from "@/lib/orders";
import { formatEuro, fromCents } from "@/lib/money";
import Card from "@/components/admin/ui/Card";
import OrderStatusPill from "@/components/admin/OrderStatusPill";
import type { OrderStatus } from "@/lib/admin/order-types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;
  const orders = await listCustomerOrders(user.id);

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-panel">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
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

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-8 sm:px-6">
        <div>
          <h1 className="font-display text-2xl font-semibold text-heading">
            Welcome back, {user.name || user.email}
          </h1>
          <p className="mt-1 text-sm text-muted">
            Your Kebabish account.
          </p>
        </div>

        <Card>
          <div className="flex items-center gap-2">
            <User size={18} className="text-ember-600" />
            <h2 className="font-display text-lg font-semibold text-heading">
              Your details
            </h2>
          </div>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-center gap-2 text-body-text">
              <Mail size={14} className="shrink-0 text-faint" />
              {user.email}
            </div>
          </dl>
        </Card>

        <div>
          <h2 className="font-display text-lg font-semibold text-heading">
            Your orders
          </h2>

          {orders.length === 0 ? (
            <Card className="mt-3 flex flex-col items-center gap-2 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
                <ShoppingBag size={22} />
              </span>
              <h3 className="font-display text-lg font-semibold text-heading">
                No orders yet
              </h3>
              <p className="max-w-sm text-sm text-muted">
                Once you place an order, it&apos;ll show up here.
              </p>
              <Link
                href="/menu"
                className="mt-2 inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
              >
                <Phone size={15} />
                View the menu
              </Link>
            </Card>
          ) : (
            <div className="mt-3 space-y-3">
              {orders.map((order) => (
                <Card key={order.reference} padded={false}>
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline p-5">
                    <div>
                      <p className="font-display text-sm font-semibold text-heading">
                        {order.reference}
                      </p>
                      <p className="mt-0.5 text-xs text-muted">
                        {new Date(order.placedAt).toLocaleDateString("en-GB", {
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <OrderStatusPill status={order.status as OrderStatus} />
                      <p className="font-display text-sm font-semibold text-heading">
                        {formatEuro(fromCents(order.totalCents))}
                      </p>
                    </div>
                  </div>

                  <ul className="divide-y divide-hairline">
                    {order.lines.map((line, i) => (
                      <li
                        key={i}
                        className="flex justify-between gap-3 px-5 py-3 text-sm"
                      >
                        <span className="text-body-text">
                          {line.quantity}× {line.name}
                          {line.options.length > 0 && (
                            <span className="block text-xs text-faint">
                              {line.options.map((o) => o.optionLabel).join(", ")}
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-heading">
                          {formatEuro(fromCents(line.lineTotalCents))}
                        </span>
                      </li>
                    ))}
                  </ul>

                  <div className="flex items-start gap-2 border-t border-hairline p-5 text-xs text-muted">
                    <MapPin size={13} className="mt-0.5 shrink-0 text-faint" />
                    {order.addressStreet}, {order.addressPostcode} {order.addressCity}
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
