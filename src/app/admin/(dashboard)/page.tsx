import AdminShell from "@/components/admin/AdminShell";
import DashboardView from "@/components/admin/DashboardView";
import { listCustomers, listOrders } from "@/lib/admin/orders-data";
import { auth } from "@/lib/auth";
import { getSettings } from "@/lib/admin/store";
import BackupReminder from "@/components/admin/BackupReminder";
import StockAlertsCard from "@/components/admin/StockAlertsCard";
import { listStockAlerts } from "@/lib/stock";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const [orders, customers, session, settings, stockAlerts] = await Promise.all([
    listOrders(),
    listCustomers(),
    auth(),
    getSettings(),
    listStockAlerts().catch(() => []),
  ]);

  return (
    <AdminShell title="Dashboard">
      {/* Only the owner can download a backup, so only the owner is nagged. */}
      {session?.user?.role === "owner" && (
        <BackupReminder
          lastBackupAt={settings.lastBackupAt}
          hasPaidOrders={orders.some((o) => o.paymentStatus === "paid")}
        />
      )}
      <StockAlertsCard alerts={stockAlerts} />
      <DashboardView
        orders={orders}
        customerJoinDates={customers.map((c) => c.joinedAt)}
      />
    </AdminShell>
  );
}
