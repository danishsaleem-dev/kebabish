import { DatabaseZap } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import StockRequestsList from "@/components/admin/StockRequestsList";
import { listStockRequests } from "@/lib/stock-requests/data";

export const metadata = { title: "Dish requests" };
export const dynamic = "force-dynamic";

export default async function RequestsPage() {
  const { ready, items } = await listStockRequests();

  if (!ready) {
    return (
      <AdminShell title="Dish requests">
        <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <DatabaseZap size={22} />
          </span>
          <h2 className="font-display text-lg font-semibold text-heading">The requests table isn&apos;t set up yet</h2>
          <p className="max-w-md text-sm text-muted">
            Run <code className="rounded bg-hairline px-1">supabase/migrations/0021_requests_and_order_edits.sql</code>{" "}
            once in the Supabase SQL editor. Until then the &ldquo;request this dish&rdquo; form on the website can&apos;t
            save anything.
          </p>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Dish requests">
      <div className="space-y-4 sm:space-y-6">
        <p className="max-w-2xl text-sm text-muted">
          When a dish is sold out it stays on the menu, and a customer who wants it can ask for it here — how many,
          and for when. Get back to them, then mark it. Nothing is reserved or charged by a request.
        </p>
        <StockRequestsList items={items} />
      </div>
    </AdminShell>
  );
}
