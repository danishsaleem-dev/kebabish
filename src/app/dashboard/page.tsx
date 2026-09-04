import Image from "next/image";
import Link from "next/link";
import { LogOut, Mail, Phone, ShoppingBag, User } from "lucide-react";
import { auth } from "@/lib/auth";
import { signOutAction } from "@/app/logout-action";
import Card from "@/components/admin/ui/Card";

export const dynamic = "force-dynamic";

/**
 * Minimal customer landing page. There isn't much to show yet — the site
 * has no cart/checkout, so there's no real order history to display. This
 * exists as the genuine, working destination /login redirects a customer
 * to, ready to grow into account details, saved addresses and order
 * history once checkout exists.
 */
export default async function DashboardPage() {
  const session = await auth();
  const user = session!.user;

  return (
    <div className="min-h-screen bg-canvas">
      <header className="border-b border-hairline bg-panel">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-4 sm:px-6">
          <Image
            src="/logo/Kebabish-light.png"
            alt="Kebabish"
            width={440}
            height={330}
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

        <Card className="flex flex-col items-center gap-2 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
            <ShoppingBag size={22} />
          </span>
          <h2 className="font-display text-lg font-semibold text-heading">
            No orders yet
          </h2>
          <p className="max-w-sm text-sm text-muted">
            Once you place an order, it&apos;ll show up here. For now, order
            via WhatsApp from the menu — online checkout is on its way.
          </p>
          <Link
            href="/menu"
            className="mt-2 inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            <Phone size={15} />
            View the menu
          </Link>
        </Card>
      </main>
    </div>
  );
}
