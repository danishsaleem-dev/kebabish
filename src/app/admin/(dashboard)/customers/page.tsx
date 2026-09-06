import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import CustomersTable from "@/components/admin/CustomersTable";
import { listCustomers, listOrders } from "@/lib/admin/orders-data";
import { formatMoney } from "@/lib/admin/units";

export const metadata = { title: "Customers" };
export const dynamic = "force-dynamic";

export default async function CustomersPage() {
  const [customers, orders] = await Promise.all([listCustomers(), listOrders()]);

  const active = customers.filter((c) => c.status === "active").length;
  const lapsed = customers.filter((c) => c.status === "lapsed").length;
  const guestCount = customers.filter((c) => c.accountType === "guest").length;
  const lifetime = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const avgOrder =
    orders.reduce((sum, o) => sum + o.total, 0) / Math.max(1, orders.length);

  const stats = [
    {
      label: "Total customers",
      value: String(customers.length),
      hint: `${customers.length - guestCount} registered · ${guestCount} guest`,
    },
    { label: "Active", value: String(active) },
    { label: "Lapsed", value: String(lapsed) },
    { label: "Avg. order value", value: formatMoney(avgOrder) },
    { label: "Lifetime value", value: formatMoney(lifetime) },
  ];

  return (
    <AdminShell title="Customers">
      <div className="space-y-4 sm:space-y-6">
        <Card padded={false}>
          <div className="grid divide-y divide-hairline sm:grid-cols-3 sm:divide-x sm:divide-y-0 lg:grid-cols-5">
            {stats.map((stat) => (
              <div key={stat.label} className="p-5">
                <p className="text-sm text-muted">{stat.label}</p>
                <p className="mt-1.5 font-display text-2xl font-semibold text-heading">
                  {stat.value}
                </p>
                {stat.hint && (
                  <p className="mt-0.5 text-xs text-faint">{stat.hint}</p>
                )}
              </div>
            ))}
          </div>
        </Card>

        <CustomersTable customers={customers} />
      </div>
    </AdminShell>
  );
}
