import AdminShell from "@/components/admin/AdminShell";
import ReportsView from "@/components/admin/ReportsView";

export const metadata = { title: "Reports" };

export default function ReportsPage() {
  return (
    <AdminShell title="Reports">
      <ReportsView />
    </AdminShell>
  );
}
