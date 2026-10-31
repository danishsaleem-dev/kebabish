import Link from "next/link";
import { Pencil, Plus, ReceiptText, TriangleAlert } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { listSupplies } from "@/lib/admin/store";
import { deleteSupplyAction } from "@/app/admin/(dashboard)/menu/supplies/actions";
import { formatMoney } from "@/lib/admin/units";
import { SUPPLY_KIND_LABELS, perOrderCost, supplyCostPerUnit } from "@/lib/supplies";
import type { SupplyKind } from "@/lib/admin/store/types";

export const metadata = { title: "Supplies" };
export const dynamic = "force-dynamic";

const KINDS: SupplyKind[] = ["per-order", "running"];

export default async function SuppliesPage() {
  const supplies = await listSupplies();
  const packaging = perOrderCost(supplies);

  return (
    <AdminShell title="Supplies">
      <div className="space-y-4 sm:space-y-6">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">Supplies</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              Boxes, bags, gloves and everything else the kitchen buys that isn&apos;t food. They never
              appear in recipes or allergen lists; they feed the Supplies part of Reports.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/admin/menu/supplies/purchases"
              className="inline-flex items-center gap-2 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
            >
              <ReceiptText size={16} />
              Log a purchase
            </Link>
            <Link
              href="/admin/menu/supplies/new"
              className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              <Plus size={16} />
              Add supply
            </Link>
          </div>
        </Card>

        <Card>
          <p className="text-sm text-muted">Packaging cost carried by one order</p>
          <p className="mt-1 font-display text-2xl font-semibold text-heading">
            {formatMoney(packaging.total)}
          </p>
          <p className="mt-1 text-xs text-muted">
            Added up from the per-order supplies below, at today&apos;s prices. Reports multiply it by
            the number of orders in the period.
          </p>
          {packaging.incomplete.length > 0 && (
            <p className="mt-3 flex items-start gap-2 text-sm text-warn">
              <TriangleAlert size={16} className="mt-0.5 shrink-0" />
              <span>
                {packaging.incomplete.length} per-order supplies aren&apos;t counted yet because they
                have no &ldquo;used per order&rdquo; amount or no price. Edit them to include them.
              </span>
            </p>
          )}
        </Card>

        {KINDS.map((kind) => {
          const rows = supplies.filter((s) => s.kind === kind);
          return (
            <Card key={kind} padded={false}>
              <p className="px-5 py-4 font-display text-base font-semibold text-heading sm:px-6">
                {SUPPLY_KIND_LABELS[kind]}
              </p>
              {rows.length === 0 ? (
                <p className="border-t border-hairline px-5 py-6 text-sm text-muted sm:px-6">
                  Nothing here yet.
                </p>
              ) : (
                <div className="overflow-x-auto border-t border-hairline">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead>
                      <tr className="bg-canvas/60">
                        {[
                          "Supply",
                          "Base quantity",
                          "Base price",
                          "Cost per unit",
                          ...(kind === "per-order" ? ["Used per order", "Per order"] : []),
                          "",
                        ].map((h, i) => (
                          <th
                            key={`${h}-${i}`}
                            scope="col"
                            className="px-5 py-2.5 text-xs font-semibold text-muted sm:px-6"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hairline">
                      {rows.map((s) => {
                        const cpu = supplyCostPerUnit(s);
                        const line = packaging.lines.find((l) => l.supplyId === s.id);
                        const dash = <span className="text-faint">—</span>;
                        return (
                          <tr key={s.id} className="hover:bg-canvas/60">
                            <td className="px-5 py-3.5 text-sm font-medium text-heading sm:px-6">
                              {s.name}
                              {s.supplier && (
                                <span className="ml-2 text-xs font-normal text-faint">{s.supplier}</span>
                              )}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">
                              {s.baseQuantity !== undefined ? `${s.baseQuantity.toLocaleString("en-GB")} ${s.unit}` : dash}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">
                              {s.basePrice !== undefined ? formatMoney(s.basePrice) : dash}
                            </td>
                            <td className="whitespace-nowrap px-5 py-3.5 text-sm font-semibold text-heading sm:px-6">
                              {cpu !== null ? `€ ${cpu.toFixed(4)}` : dash}
                            </td>
                            {kind === "per-order" && (
                              <>
                                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">
                                  {s.perOrderQuantity !== undefined ? `${s.perOrderQuantity} ${s.unit}` : (
                                    <span className="text-warn">Not set</span>
                                  )}
                                </td>
                                <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">
                                  {line ? `€ ${line.cost.toFixed(4)}` : dash}
                                </td>
                              </>
                            )}
                            <td className="px-5 py-3.5 sm:px-6">
                              <div className="flex items-center justify-end gap-1">
                                <Link
                                  href={`/admin/menu/supplies/${s.id}/edit`}
                                  aria-label={`Edit ${s.name}`}
                                  className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
                                >
                                  <Pencil size={15} />
                                </Link>
                                <DeleteButton
                                  action={deleteSupplyAction}
                                  hiddenField={{ name: "id", value: s.id }}
                                  compact
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </AdminShell>
  );
}
