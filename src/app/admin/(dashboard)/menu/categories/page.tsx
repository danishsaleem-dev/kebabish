import Link from "next/link";
import { ChevronDown, ChevronUp, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { listCategories, listItems } from "@/lib/admin/store";
import { deleteCategoryAction, moveCategoryAction } from "@/app/admin/(dashboard)/menu/actions";

export const metadata = { title: "Categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage() {
  const [categories, items] = await Promise.all([listCategories(), listItems()]);

  return (
    <AdminShell title="Categories">
      <div className="space-y-4 sm:space-y-6">
        <Card className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-heading">
              Menu categories
            </h2>
            <p className="mt-1 max-w-xl text-sm text-muted">
              Every dish belongs to one category. The order here is the order
              customers see on the public menu.
            </p>
          </div>
          <Link
            href="/admin/menu/categories/new"
            className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            <Plus size={16} />
            Add category
          </Link>
        </Card>

        <Card padded={false}>
          <ul className="divide-y divide-hairline">
            {categories.map((category, index) => {
              const count = items.filter(
                (i) => i.categoryId === category.id
              ).length;

              return (
                <li
                  key={category.id}
                  className="flex items-center gap-3 px-4 py-4 transition-colors hover:bg-canvas/60 sm:px-6"
                >
                  <div className="hidden flex-col sm:flex">
                    <MoveButton
                      id={category.id}
                      direction="up"
                      disabled={index === 0}
                    />
                    <MoveButton
                      id={category.id}
                      direction="down"
                      disabled={index === categories.length - 1}
                    />
                  </div>

                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-canvas font-display text-sm font-semibold text-muted">
                    {category.position}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-heading">
                      {category.label}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {category.description || "No description"}
                    </p>
                  </div>

                  <span className="hidden shrink-0 rounded-full bg-canvas px-3 py-1 text-xs font-semibold text-muted sm:inline">
                    {count} items
                  </span>

                  <span
                    className={`hidden shrink-0 items-center gap-1.5 text-xs font-semibold md:inline-flex ${
                      category.visible ? "text-success" : "text-faint"
                    }`}
                  >
                    {category.visible ? <Eye size={14} /> : <EyeOff size={14} />}
                    {category.visible ? "Visible" : "Hidden"}
                  </span>

                  <div className="flex shrink-0 items-center gap-1">
                    <Link
                      href={`/admin/menu/categories/${category.id}/edit`}
                      aria-label={`Edit ${category.label}`}
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-canvas hover:text-heading"
                    >
                      <Pencil size={15} />
                    </Link>
                    <DeleteButton
                      action={deleteCategoryAction}
                      hiddenField={{ name: "id", value: category.id }}
                      label={`Delete ${category.label}`}
                      compact
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}

function MoveButton({
  id,
  direction,
  disabled,
}: {
  id: string;
  direction: "up" | "down";
  disabled: boolean;
}) {
  return (
    <form action={moveCategoryAction}>
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="direction" value={direction} />
      <button
        type="submit"
        disabled={disabled}
        aria-label={`Move ${direction}`}
        className="flex h-5 w-6 items-center justify-center rounded text-faint transition-colors hover:text-heading disabled:opacity-30 disabled:hover:text-faint"
      >
        {direction === "up" ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
    </form>
  );
}
