import Link from "next/link";
import { ArrowLeft, TriangleAlert } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import PurchaseForm from "@/components/admin/PurchaseForm";
import { listSupplies } from "@/lib/admin/store";
import { listPurchasesBetween } from "@/lib/supplies-data";
import { logPurchaseAction, deletePurchaseAction } from "@/app/admin/(dashboard)/menu/supplies/actions";
import { addDaysKey } from "@/lib/admin/report-range";
import { todayKey } from "@/lib/rider-shifts";
import { formatMoney } from "@/lib/admin/units";

export const metadata = { title: "Log a purchase" };
export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const today = todayKey();
  const [supplies, { ready, purchases }] = await Promise.all([
    listSupplies(),
    listPurchasesBetween(addDaysKey(today, -90), today),
  ]);

  return (
    <AdminShell title="Log a purchase">
      <div className="space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu/supplies"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to supplies
        </Link>

        {!ready && (
          <Card className="flex items-start gap-3 border-warn/30 bg-warn-soft">
            <TriangleAlert size={18} className="mt-0.5 shrink-0 text-warn" />
            <p className="text-sm leading-relaxed text-warn">
              <span className="font-semibold">Purchases aren&apos;t set up yet.</span> Run
              <code className="mx-1">supabase/migrations/0028_supply_purchases.sql</code>
              in the Supabase SQL editor once, then come back here.
            </p>
          </Card>
        )}

        <Card>
          <CardHeader
            title="Bought something?"
            subtitle="Each purchase you log here counts towards the Supplies spend in Reports, on the day you bought it."
          />
          <div className="mt-6">
            <PurchaseForm
              action={logPurchaseAction}
              today={today}
              supplies={supplies.map((s) => ({ id: s.id, name: s.name, unit: s.unit }))}
            />
          </div>
        </Card>

        <Card padded={false}>
          <p className="px-5 py-4 font-display text-base font-semibold text-heading sm:px-6">
            Last 90 days
          </p>
          {purchases.length === 0 ? (
            <p className="border-t border-hairline px-5 py-6 text-sm text-muted sm:px-6">
              No purchases logged yet.
            </p>
          ) : (
            <div className="overflow-x-auto border-t border-hairline">
              <table className="w-full min-w-[640px] border-collapse text-left">
                <thead>
                  <tr className="bg-canvas/60">
                    {["Day", "Supply", "Quantity", "Paid", "Note", ""].map((h, i) => (
                      <th key={`${h}-${i}`} scope="col" className="px-5 py-2.5 text-xs font-semibold text-muted sm:px-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {purchases.map((p) => (
                    <tr key={p.id} className="hover:bg-canvas/60">
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">{p.purchasedOn}</td>
                      <td className="px-5 py-3.5 text-sm font-medium text-heading sm:px-6">{p.supplyName}</td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">
                        {p.quantity.toLocaleString("en-GB")}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-heading sm:px-6">
                        {formatMoney(p.amountCents / 100)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-muted sm:px-6">{p.note ?? ""}</td>
                      <td className="px-5 py-3.5 sm:px-6">
                        <div className="flex justify-end">
                          <DeleteButton
                            action={deletePurchaseAction}
                            hiddenField={{ name: "id", value: p.id }}
                            compact
                          />
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
