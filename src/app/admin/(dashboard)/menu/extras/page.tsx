import Link from "next/link";
import { ArrowLeft, Plus, SlidersHorizontal, Pencil } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { deleteOptionGroupAction } from "@/app/admin/(dashboard)/menu/actions";
import { listOptionGroups, listItems } from "@/lib/admin/store";
import { formatMoney } from "@/lib/admin/units";

export const metadata = { title: "Extras" };
export const dynamic = "force-dynamic";

export default async function ExtrasPage() {
  const [groups, items] = await Promise.all([listOptionGroups(), listItems()]);

  const usage = Object.fromEntries(
    groups.map((g) => [
      g.id,
      items.filter((i) => i.optionGroupIds.includes(g.id)).length,
    ])
  );

  return (
    <AdminShell title="Extras">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to menu
        </Link>

        <Card className="flex items-start gap-3">
          <SlidersHorizontal size={18} className="mt-0.5 shrink-0 text-ember-600" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardHeader title="Extras & options" />
              <Link
                href="/admin/menu/extras/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-ember-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-ember-500"
              >
                <Plus size={14} />
                Add group
              </Link>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Groups of extras customers can add to a dish — sauces, drinks,
              toppings. Attach a group to as many dishes as you like from the
              dish&apos;s own edit screen; changing a price here changes it
              everywhere at once.
            </p>
          </div>
        </Card>

        {groups.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-muted">
              No extras yet. Add a group and it becomes available to attach to
              any dish.
            </p>
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-hairline">
              {groups.map((group) => (
                <li
                  key={group.id}
                  className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-heading">{group.label}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {group.options.length} option
                      {group.options.length === 1 ? "" : "s"} ·{" "}
                      {group.minChoices === 0
                        ? "optional"
                        : `pick at least ${group.minChoices}`}
                      {group.maxChoices > 1 && `, up to ${group.maxChoices}`} ·{" "}
                      {usage[group.id] === 0
                        ? "not on any dish"
                        : `on ${usage[group.id]} dish${usage[group.id] === 1 ? "" : "es"}`}
                    </p>
                    <p className="mt-1 truncate text-xs text-faint">
                      {group.options
                        .map(
                          (o) =>
                            `${o.label}${o.price > 0 ? ` ${formatMoney(o.price)}` : ""}`
                        )
                        .join(" · ")}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Link
                      href={`/admin/menu/extras/${group.id}/edit`}
                      aria-label={`Edit ${group.label}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-heading"
                    >
                      <Pencil size={16} />
                    </Link>
                    <DeleteButton
                      action={deleteOptionGroupAction}
                      hiddenField={{ name: "id", value: group.id }}
                      label={`Delete ${group.label}`}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}
