import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import ManualOrderForm from "@/components/admin/ManualOrderForm";
import { getSettings, listCategories, listItems, listOptionGroups } from "@/lib/admin/store";
import { isSellablePrice } from "@/lib/money";
import { listCustomerOptions } from "@/lib/admin/orders-data";
import { readStockMap } from "@/lib/stock";
import { stockLevel } from "@/lib/stock-status";

export const metadata = { title: "Create order" };
export const dynamic = "force-dynamic";

export default async function CreateOrderPage() {
  const [categories, items, optionGroups, settings, customers, stock] = await Promise.all([
    listCategories(),
    listItems(),
    listOptionGroups(),
    getSettings(),
    // A failure here shouldn't stop phone orders being taken — the form just has no picker list.
    listCustomerOptions().catch((error) => {
      console.error("[create-order] couldn't load customers:", error);
      return [];
    }),
    readStockMap(),
  ]);

  // Only what can actually be ordered — the server refuses the rest anyway
  // (hidden, sold out, no price, or in a hidden category).
  const visibleCategories = categories
    .filter((c) => c.visible)
    .sort((a, b) => a.position - b.position);
  const categoryIds = new Set(visibleCategories.map((c) => c.id));
  const dishes = items
    .filter(
      (i) =>
        i.visible &&
        !i.soldOut &&
        stockLevel(stock?.get(i.slug)) !== "out" &&
        isSellablePrice(i.price) &&
        categoryIds.has(i.categoryId)
    )
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
          like a website order (you can change a dish&apos;s price, add a coupon, and enter a day that has already passed), and appears in Orders, the kitchen and the rider&apos;s list.
        </p>

        <ManualOrderForm
          deliveryFee={settings.deliveryFee}
          freeDeliveryOver={settings.freeDeliveryOver ?? null}
          customers={customers}
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
