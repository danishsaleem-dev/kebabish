import AdminShell from "@/components/admin/AdminShell";
import ReportsView from "@/components/admin/ReportsView";
import { getCategoryByDish, listOrders } from "@/lib/admin/orders-data";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [orders, categoryByDish] = await Promise.all([
    listOrders(),
    getCategoryByDish(),
  ]);

  return (
    <AdminShell title="Reports">
      <ReportsView orders={orders} categoryByDish={categoryByDish} />
    </AdminShell>
  );
}
