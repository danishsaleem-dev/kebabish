import AdminShell from "@/components/admin/AdminShell";
import OrdersTable from "@/components/admin/OrdersTable";
import { orders } from "@/lib/admin/mock-data";

export const metadata = { title: "New orders" };

export default function NewOrdersPage() {
  return (
    <AdminShell title="New orders">
      <OrdersTable
        orders={orders.filter((o) => o.status === "new")}
        title="Waiting to be accepted"
        lockedStatus="new"
      />
    </AdminShell>
  );
}
