/**
 * Domain types and label vocabulary for orders/customers/dashboard/reports.
 *
 * Not "fake data" — these are the real status/channel/period vocabulary the
 * UI is built around, kept separate from the data itself so the real
 * Supabase-backed queries (orders-data.ts) and the old mock generator could
 * both target the same shapes during the migration.
 */

export type OrderStatus =
  | "new"
  | "preparing"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export type OrderChannel = "whatsapp" | "website";
export type Fulfilment = "delivery" | "takeaway";
export type CustomerStatus = "new" | "active" | "lapsed";

export interface AdminOrderLine {
  /** Display name — dish plus any chosen extras/instructions in parens. */
  name: string;
  /** The dish alone, as ordered — what Top Dishes groups by. */
  baseName: string;
  /** item_slug — what Sales by Category looks up against today's menu. */
  slug: string;
  quantity: number;
  unitPrice: number;
}

export interface AdminOrder {
  id: string;
  reference: string;
  /** Null for guest checkout — orders don't require an account. */
  customerId: string | null;
  customerName: string;
  phone: string;
  placedAt: string;
  status: OrderStatus;
  channel: OrderChannel;
  fulfilment: Fulfilment;
  town: string;
  address: string;
  lines: AdminOrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  note?: string;
}

export interface AdminCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  /**
   * From their most recent delivery order — customers carry no address of
   * their own. `address` is already the full "street, postcode city" line.
   */
  town: string;
  address: string;
  joinedAt: string;
  lastOrderAt: string | null;
  orderCount: number;
  totalSpent: number;
  favouriteDish: string | null;
  preferredChannel: OrderChannel;
  status: CustomerStatus;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  new: "New",
  active: "Active",
  lapsed: "Lapsed",
};

export const CHANNEL_LABELS: Record<OrderChannel, string> = {
  whatsapp: "WhatsApp",
  website: "Website",
};

export type Period = "daily" | "weekly" | "monthly";
export type StatusFilter = "all" | "delivered" | "cancelled" | "preparing";

export const PERIOD_LABELS: Record<Period, string> = {
  daily: "Daily",
  weekly: "Weekly",
  monthly: "Monthly",
};

export const STATUS_FILTER_LABELS: Record<StatusFilter, string> = {
  all: "All statuses",
  delivered: "Delivered",
  cancelled: "Cancelled",
  preparing: "Preparing",
};

export type NotificationKind = "order" | "system";

export interface AdminNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  minutesAgo: number;
  read: boolean;
  href?: string;
}

/** "4 min ago", "3 h ago", "2 d ago" */
export function relativeTime(minutesAgo: number): string {
  if (minutesAgo < 1) return "just now";
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  if (minutesAgo < 1440) return `${Math.round(minutesAgo / 60)} h ago`;
  return `${Math.round(minutesAgo / 1440)} d ago`;
}
