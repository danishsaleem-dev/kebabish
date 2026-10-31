import Link from "next/link";
import { Pencil, Plus, Search, TriangleAlert } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { listIngredients, listMeasurements } from "@/lib/admin/store";
import { deleteMeasurementAction } from "@/app/admin/(dashboard)/menu/measurements/actions";
import { MEASUREMENT_FORM_LABELS, measurementName, ratioLooksOff, spoonRatio } from "@/lib/measurements";

export const metadata = { title: "Measurement chart" };
export const dynamic = "force-dynamic";

export default async function MeasurementsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; show?: string }>;
}) {
  const { q = "", show = "all" } = await searchParams;
  const [measurements, ingredients] = await Promise.all([listMeasurements(), listIngredients()]);
  const names = new Map(ingredients.map((i) => [i.id, i.name]));
  const linkedIds = new Set(measurements.map((m) => m.ingredientId).filter(Boolean));

  const needle = q.trim().toLowerCase();
  const rows = measurements.filter((m) => {
    const linked = Boolean(m.ingredientId && names.has(m.ingredientId));
    if (show === "unlinked" && linked) return false;
    if (show === "check" && !ratioLooksOff(m)) return false;
    if (!needle) return true;
    return [measurementName(m, names), m.nameEn, m.nameUr ?? ""].some((s) => s.toLowerCase().includes(needle));
  });

  const unmeasured = ingredients.filter((i) => !linkedIds.has(i.id)).length;
  const ratioChecks = measurements.filter((m) => ratioLooksOff(m)).length;
  const dash = <span className="text-faint">—</span>;
  const tab = (value: string, label: string) => (
    <Link
      key={value}
      href={`/admin/menu/measurements?show=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors ${
        show === value ? "bg-ember-600 text-cream-50" : "border border-hairline text-body-text hover:bg-canvas"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <AdminShell title="Measurement chart">
      <div className="space-y-4 sm:space-y-6">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">Measurement chart</h2>
            <p className="mt-1 max-w-2xl text-sm text-muted">
              How many grams a tablespoon and a teaspoon of each ingredient weigh. Every ingredient packs
              differently, so each is measured once and kept here, linked to the ingredient in your price
              list. {measurements.length} rows · {unmeasured} ingredients have no measurement yet.
            </p>
          </div>
          <Link
            href="/admin/menu/measurements/new"
            className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            <Plus size={16} />
            Add measurement
          </Link>
        </Card>

        <Card padded={false}>
          <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-5 py-4 sm:px-6">
            <form action="/admin/menu/measurements" className="flex min-w-0 flex-1 items-center gap-2">
              <input type="hidden" name="show" value={show} />
              <div className="relative min-w-0 flex-1 sm:max-w-xs">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                <input
                  name="q"
                  defaultValue={q}
                  placeholder="Search English or Roman Urdu"
                  className="w-full rounded-lg border border-hairline bg-panel py-2.5 pl-9 pr-3 text-base text-heading placeholder:text-faint focus:border-ember-500 focus:outline-none focus:ring-2 focus:ring-ember-500/25 sm:text-sm"
                />
              </div>
              <button className="rounded-lg border border-hairline px-3.5 py-2.5 text-sm font-semibold text-body-text hover:bg-canvas">
                Search
              </button>
            </form>
            <div className="flex flex-wrap gap-2">
              {tab("all", "All")}
              {tab("unlinked", "Not in price list")}
              {tab("check", `Check spoons (${ratioChecks})`)}
            </div>
          </div>

          {rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted sm:px-6">Nothing matches.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] border-collapse text-left">
                <thead>
                  <tr className="bg-canvas/60">
                    {["Ingredient", "Roman Urdu", "1 tbsp", "1 tsp", "tbsp ÷ tsp", "Form", "In price list", ""].map((h, i) => (
                      <th key={`${h}-${i}`} scope="col" className="px-5 py-2.5 text-xs font-semibold text-muted sm:px-6">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-hairline">
                  {rows.map((m) => {
                    const linked = Boolean(m.ingredientId && names.has(m.ingredientId));
                    const ratio = spoonRatio(m);
                    const off = ratioLooksOff(m);
                    return (
                      <tr key={m.id} className="hover:bg-canvas/60">
                        <td className="px-5 py-3.5 text-sm font-medium text-heading sm:px-6">
                          {measurementName(m, names)}
                          {linked && measurementName(m, names) !== m.nameEn && (
                            <span className="ml-2 text-xs font-normal text-faint">chart: {m.nameEn}</span>
                          )}
                          {m.note && <span className="block text-xs font-normal text-muted">{m.note}</span>}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted sm:px-6">{m.nameUr ?? dash}</td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">
                          {m.gramsPerTbsp !== undefined ? `${m.gramsPerTbsp} g` : dash}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-sm text-body-text sm:px-6">
                          {m.gramsPerTsp !== undefined ? `${m.gramsPerTsp} g` : dash}
                        </td>
                        <td className={`whitespace-nowrap px-5 py-3.5 text-sm sm:px-6 ${off ? "font-semibold text-warn" : "text-muted"}`}>
                          {ratio !== null ? (
                            <span className="inline-flex items-center gap-1.5">
                              {off && <TriangleAlert size={14} aria-hidden="true" />}
                              {ratio}
                              {off && <span className="sr-only"> (worth a second look)</span>}
                            </span>
                          ) : (
                            dash
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-muted sm:px-6">{m.form ? MEASUREMENT_FORM_LABELS[m.form] : dash}</td>
                        <td className="px-5 py-3.5 text-sm sm:px-6">
                          {linked ? (
                            <span className="text-success">Linked</span>
                          ) : (
                            <span className="text-muted">Not linked</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 sm:px-6">
                          <div className="flex items-center justify-end gap-1">
                            <Link
                              href={`/admin/menu/measurements/${m.id}/edit`}
                              aria-label={`Edit ${m.nameEn}`}
                              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
                            >
                              <Pencil size={15} />
                            </Link>
                            <DeleteButton action={deleteMeasurementAction} hiddenField={{ name: "id", value: m.id }} compact />
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
      </div>
    </AdminShell>
  );
}
