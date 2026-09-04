import AdminShell from "@/components/admin/AdminShell";
import DashboardView from "@/components/admin/DashboardView";

export default function AdminDashboardPage() {
  return (
    <AdminShell title="Dashboard">
      <DashboardView />
    </AdminShell>
  );
}
