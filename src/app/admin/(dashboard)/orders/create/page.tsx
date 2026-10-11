import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import ManualOrderForm from "@/components/admin/ManualOrderForm";
import { listCategories, listItems, listOptionGroups } from "@/lib/admin/store";
import { isSellablePrice } from "@/lib/money";

export const metadata = { title: "Create order" };
export const dynamic = "force-dynamic";

export default async function CreateOrderPage() {
  const [categories, items, optionGroups] = await Promise.all([
    listCategories(),
    listItems(),
    listOptionGroups(),
  ]);

  // Only what can actually be ordered — the server refuses the rest anyway
  // (hidden, sold out, no price, or in a hidden category).
  const visibleCategories = categories
    .filter((c) => c.visible)
    .sort((a, b) => a.position - b.position);
  const categoryIds = new Set(visibleCategories.map((c) => c.id));
  const dishes = items
    .filter((i) => i.visible && !i.soldOut && isSellablePrice(i.price) && categoryIds.has(i.categoryId))
    .map((i) => ({
      slug: i.slug,
      name: i.name,
      price: i.price as number,
      categoryId: i.categoryId,
      optionGroupIds: i.optionGroupIds ?? [],
    }));

  return (
    <AdminShell title="Create order">
      <div className="space-y-4 sm:space-y-6">
        <Link
          href="/admin/orders"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to orders
        </Link>

        <p className="max-w-2xl text-sm text-muted">
          For an order that comes in by phone or WhatsApp. It&apos;s priced from the menu exactly
          like a website order, and appears in Orders, the kitchen and the rider&apos;s list.
        </p>

        <ManualOrderForm
          categories={visibleCategories.map((c) => ({ id: c.id, label: c.label }))}
          dishes={dishes}
          groups={optionGroups.map((g) => ({
            id: g.id,
            label: g.label,
            minChoices: g.minChoices,
            maxChoices: g.maxChoices,
            options: g.options.map((o) => ({ id: o.id, label: o.label, price: o.price })),
          }))}
        />
      </div>
    </AdminShell>
  );
}
