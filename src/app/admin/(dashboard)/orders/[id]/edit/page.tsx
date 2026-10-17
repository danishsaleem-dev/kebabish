import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import OrderEditForm from "@/components/admin/OrderEditForm";
import { editBlockedReason, loadOrderForEdit } from "@/lib/admin/order-edit";
import { listCategories, listItems, listOptionGroups } from "@/lib/admin/store";

export const metadata = { title: "Edit order" };
export const dynamic = "force-dynamic";

export default async function EditOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = await loadOrderForEdit(id);
  if (!order) notFound();

  const blocked = editBlockedReason(order);
  const back = (
    <Link
      href={`/admin/orders/${order.id}`}
      className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
    >
      <ArrowLeft size={16} />
      Back to {order.reference}
    </Link>
  );

  if (blocked) {
    return (
      <AdminShell title={`Edit ${order.reference}`}>
        <div className="space-y-4 sm:space-y-6">
          {back}
          <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
              <Lock size={22} />
            </span>
            <p className="max-w-md text-sm text-muted">{blocked}</p>
          </Card>
        </div>
      </AdminShell>
    );
  }

  const [categories, items, optionGroups] = await Promise.all([
    listCategories(),
    listItems(),
    listOptionGroups(),
  ]);

  // Any dish on the menu — including a sold-out one, which staff may still send out.
  const visibleCategories = categories.filter((c) => c.visible).sort((a, b) => a.position - b.position);
  const categoryIds = new Set(visibleCategories.map((c) => c.id));
  const dishes = items
    .filter((i) => i.visible && categoryIds.has(i.categoryId))
    .map((i) => ({
      slug: i.slug,
      name: i.name,
      price: i.price,
      soldOut: i.soldOut,
      categoryId: i.categoryId,
      optionGroupIds: i.optionGroupIds ?? [],
    }));

  return (
    <AdminShell title={`Edit ${order.reference}`}>
      <div className="space-y-4 sm:space-y-6">
        {back}
        <p className="max-w-2xl text-sm text-muted">
          Change what is in this order — swap a dish that isn&apos;t available for another, change a quantity, or set
          a different price. If the customer is being given something worth more than they pay for, the bill shows
          the regular price and the compensation. Nothing is emailed to the customer.
        </p>
        <OrderEditForm
          order={order}
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
