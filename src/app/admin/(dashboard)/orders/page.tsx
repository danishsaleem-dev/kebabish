import AdminShell from "@/components/admin/AdminShell";
import OrdersTable from "@/components/admin/OrdersTable";
import { orders } from "@/lib/admin/mock-data";

export const metadata = { title: "Orders" };

export default function OrdersPage() {
  return (
    <AdminShell title="Orders">
      <OrdersTable orders={orders} title="All orders" />
    </AdminShell>
  );
}
