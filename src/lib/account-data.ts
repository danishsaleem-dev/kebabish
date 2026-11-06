import "server-only";
import { cache } from "react";
import { listCustomerOrders, type OrderSummary } from "@/lib/orders";
import {
  getCustomerAccountState,
  getCustomerProfile,
  type CustomerProfile,
} from "@/lib/customers/accounts";
import { getCustomerRewards, type CustomerRewards } from "@/lib/rewards";

/**
 * The dashboard's reads, wrapped in React's `cache` so the layout and the
 * page it renders share one round-trip each instead of querying twice. The
 * layout needs the name for the sidebar and the live-order count for the
 * navigation badge, and every page needs some of the same rows.
 *
 * `cache` is per-request, so nothing is held between customers.
 */

/**
 * The orders a customer should see. A checkout that was started and never
 * paid (failed, expired, cancelled at the bank) is not an order as far as
 * they are concerned; staff still see those in /admin for troubleshooting.
 */
export const customerOrders = cache(
  async (customerId: string): Promise<OrderSummary[]> =>
    (await listCustomerOrders(customerId)).filter(
      (order) => !["failed", "expired", "canceled"].includes(order.paymentStatus)
    )
);

export const customerProfile = cache(
  async (customerId: string): Promise<CustomerProfile | null> => getCustomerProfile(customerId)
);

export const customerAccount = cache(async (customerId: string) =>
  getCustomerAccountState(customerId)
);

/**
 * Kebabish Punten, or null when the programme is switched off or the
 * migration hasn't been run — and then nothing about points is shown
 * anywhere, including the navigation.
 */
export const customerRewards = cache(
  async (customerId: string): Promise<CustomerRewards | null> =>
    getCustomerRewards(customerId, 60).catch(() => null)
);

/** Paid and not yet delivered or cancelled: the orders worth tracking live. */
export function liveOrders(orders: OrderSummary[]): OrderSummary[] {
  return orders.filter(
    (order) =>
      order.paymentStatus === "paid" && !["delivered", "cancelled"].includes(order.status)
  );
}
