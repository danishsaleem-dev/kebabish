import AdminShell from "@/components/admin/AdminShell";
import OrdersTable from "@/components/admin/OrdersTable";
import { orders } from "@/lib/admin/mock-data";

export const metadata = { title: "Completed orders" };

export default function CompletedOrdersPage() {
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
