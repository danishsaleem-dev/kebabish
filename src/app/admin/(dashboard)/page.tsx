import AdminShell from "@/components/admin/AdminShell";
import DashboardView from "@/components/admin/DashboardView";
import { listCustomers, listOrders } from "@/lib/admin/orders-data";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [orders, customers] = await Promise.all([listOrders(), listCustomers()]);

  return (
    <AdminShell title="Dashboard">
      <DashboardView
        orders={orders}
        customerJoinDates={customers.map((c) => c.joinedAt)}
      />
    </AdminShell>
  );
}
