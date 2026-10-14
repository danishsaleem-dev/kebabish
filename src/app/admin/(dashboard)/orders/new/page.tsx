import AdminShell from "@/components/admin/AdminShell";
import OrdersTable from "@/components/admin/OrdersTable";
import { listOrders } from "@/lib/admin/orders-data";
import { isOwner } from "@/lib/admin/guard";

export const metadata = { title: "New orders" };
export const dynamic = "force-dynamic";

export default async function NewOrdersPage() {
  const [orders, canDelete] = await Promise.all([listOrders(), isOwner()]);

  return (
    <AdminShell title="New orders">
      <OrdersTable
        orders={orders.filter((o) => o.status === "new")}
        title="Waiting to be accepted"
        lockedStatus="new"
        canDelete={canDelete}
      />
    </AdminShell>
  );
}
