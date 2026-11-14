import AdminShell from "@/components/admin/AdminShell";
import ReportsView from "@/components/admin/ReportsView";
import { getCategoryByDish, listOrders } from "@/lib/admin/orders-data";
import { latestDayKey, listShiftsBetween, todayKey } from "@/lib/rider-shifts";
import { addDaysKey } from "@/lib/admin/report-range";
import { getBusinessCalendar } from "@/lib/business-days-data";
import { getSettings, listIngredients, listRecipes, listSupplies } from "@/lib/admin/store";
import { listPurchasesBetween } from "@/lib/supplies-data";
import { analyseRecipe, indexIngredients } from "@/lib/admin/recipe-math";

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
  const calendarToday = todayKey();
  // Rounds are filed under the working day, whose label can be a date ahead of the calendar.
  const lastRoundDay = await latestDayKey();
  const [orders, categoryByDish, { shifts }, calendar, supplies, purchaseList, recipes, ingredients, settings] =
    await Promise.all([
      listOrders(),
      getCategoryByDish(),
      listShiftsBetween(addDaysKey(calendarToday, -365), lastRoundDay).catch(() => ({ shifts: [] })),
      getBusinessCalendar(),
      listSupplies().catch(() => []),
      // Same year-at-once reasoning as the rounds above; empty (not ready) without migration 0028.
      listPurchasesBetween(addDaysKey(calendarToday, -365), calendarToday).catch(() => ({
        ready: false,
        purchases: [],
      })),
      listRecipes().catch(() => []),
      listIngredients().catch(() => []),
      getSettings().catch(() => null),
    ]);

  // What one portion of each dish costs in ingredients — the same figure the Menu table and
  // the recipe page show, worked out here once so Reports does no costing of its own. A dish
  // with no recipe, or one whose ingredients have no price, is simply absent: the profit
  // screen reports it as not costed rather than treating it as free.
  const lookup = indexIngredients(ingredients);
  const costPerDish: Record<string, number> = {};
  for (const recipe of recipes) {
    const cost = analyseRecipe(recipe, lookup).costPerPortion;
    if (cost > 0) costPerDish[recipe.menuItemSlug] = cost;
  }
  // "Today" is the business day that is open, which after a late closing can already be
  // tomorrow's date — and without migration 0027 it is simply the calendar day.
  const today = calendar.ready ? calendar.open.businessDate : calendarToday;

  return (
    <AdminShell title="Reports">
      <ReportsView
        orders={orders}
        categoryByDish={categoryByDish}
        shifts={shifts}
        supplies={supplies}
        purchases={purchaseList.purchases}
        purchasesReady={purchaseList.ready}
        costPerDish={costPerDish}
        vatRatePercent={settings?.vatRatePercent ?? null}
        today={today}
        closedDays={calendar.ready ? calendar.closed : []}
        openDay={calendar.ready ? calendar.open : null}
      />
    </AdminShell>
  );
}
