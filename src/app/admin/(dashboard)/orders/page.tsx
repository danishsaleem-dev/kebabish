import AdminShell from "@/components/admin/AdminShell";
import OrdersTable from "@/components/admin/OrdersTable";
import { listOrders } from "@/lib/admin/orders-data";
import { isOwner } from "@/lib/admin/guard";

export const metadata = { title: "Orders" };
export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  const [orders, canDelete] = await Promise.all([listOrders(), isOwner()]);

  return (
    <AdminShell title="Orders">
      <OrdersTable orders={orders} title="All orders" canDelete={canDelete} />
    </AdminShell>
  );
}
