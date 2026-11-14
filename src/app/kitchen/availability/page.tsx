import { listCategories, listDeals, listItems } from "@/lib/admin/store";
import { getPublicDeals } from "@/lib/public-deals";
import { readStockMap } from "@/lib/stock";
import { stockLevel } from "@/lib/stock-status";
import AvailabilityBoard, {
  type AvailabilityGroup,
  type AvailabilityRow,
} from "@/components/kitchen/AvailabilityBoard";

export const metadata = { title: "Item availability | Kebabish" };
export const dynamic = "force-dynamic";

/**
 * What the kitchen can switch off: every dish that is on the menu, by category, and
 * the deals. Draft dishes (`visible: false`) and dishes in a hidden category are left
 * out — they aren't on the website, so there is nothing for a cook to take off it.
 *
 * Stock is read alongside, because a dish at zero is already sold out whatever its own
 * switch says: the row shows that instead of offering a switch that would do nothing.
 * A deal's own "can this still be built" answer comes from `getPublicDeals`, so this
 * screen and the website can't disagree about it.
 */
export default async function KitchenAvailabilityPage() {
  const [categories, items, deals, publicDeals, stock] = await Promise.all([
    listCategories(),
    listItems(),
    listDeals(),
    getPublicDeals("nl"),
    readStockMap().catch(() => null),
  ]);

  const visibleCategories = categories.filter((c) => c.visible);
  const groups: AvailabilityGroup[] = [];

  for (const category of visibleCategories) {
    const rows = items
      .filter((i) => i.categoryId === category.id && i.visible)
      .map((item): AvailabilityRow => {
        const entry = stock?.get(item.slug);
        const out = stockLevel(entry) === "out";
        return {
          kind: "dish",
          slug: item.slug,
          name: item.name,
          switchedOff: Boolean(item.soldOut),
          stockLeft: entry ? entry.quantity : null,
          blocked: out ? "No stock left — add a batch in the admin" : null,
        };
      });
    if (rows.length > 0) groups.push({ id: category.id, label: category.label, rows });
  }

  // Only the deals the website actually offers, and in its order.
  const stored = new Map(deals.map((d) => [d.slug, d]));
  const dealRows = publicDeals.map((deal): AvailabilityRow => {
    const switchedOff = Boolean(stored.get(deal.slug)?.soldOut);
    return {
      kind: "deal",
      slug: deal.slug,
      name: deal.name,
      switchedOff,
      stockLeft: null,
      // `deal.soldOut` also covers the switch itself, so only count what the switch can't fix.
      blocked: deal.soldOut && !switchedOff ? "A dish in this deal is unavailable" : null,
    };
  });
  if (dealRows.length > 0) groups.push({ id: "deals", label: "Deals", rows: dealRows });

  return <AvailabilityBoard groups={groups} />;
}
