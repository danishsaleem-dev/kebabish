import AdminShell from "@/components/admin/AdminShell";
import ReportsView from "@/components/admin/ReportsView";
import { getCategoryByDish, listOrders } from "@/lib/admin/orders-data";
import { listShiftsBetween, todayKey } from "@/lib/rider-shifts";
import { addDaysKey } from "@/lib/admin/report-range";

export const metadata = { title: "Reports" };
export const dynamic = "force-dynamic";

/**
 * Everything the screen needs, fetched once. The rider rounds are pulled for a year rather
 * than for the chosen range, because the range is picked in the browser and a round is one
 * tiny row per rider per day \u2014 cheaper to send them all than to make every date change a
 * round trip. Without migration 0023 the list is simply empty and the Riders area shows
 * deliveries with no kilometres.
 */
export default async function ReportsPage() {
  const today = todayKey();
  const [orders, categoryByDish, { shifts }] = await Promise.all([
    listOrders(),
    getCategoryByDish(),
    listShiftsBetween(addDaysKey(today, -365), today).catch(() => ({ shifts: [] })),
  ]);

  return (
    <AdminShell title="Reports">
      <ReportsView
        orders={orders}
        categoryByDish={categoryByDish}
        shifts={shifts}
        today={today}
      />
    </AdminShell>
  );
}
