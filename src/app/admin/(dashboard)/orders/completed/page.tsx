import AdminShell from "@/components/admin/AdminShell";
import OrdersTable from "@/components/admin/OrdersTable";
import { listOrders } from "@/lib/admin/orders-data";

export const metadata = { title: "Completed orders" };
export const dynamic = "force-dynamic";

export default async function CompletedOrdersPage() {
  const orders = await listOrders();

  return (
    <AdminShell title="Completed orders">
      <OrdersTable
        orders={orders.filter((o) => o.status === "delivered")}
        title="Delivered & picked up"
        lockedStatus="delivered"
      />
    </AdminShell>
  );
}
