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
  | "ready"
  | "on_the_way"
  | "delivered"
  | "cancelled";

export type OrderChannel = "whatsapp" | "website";
export type Fulfilment = "delivery" | "takeaway";
export type CustomerStatus = "new" | "active" | "lapsed";
export type PaymentStatus =
  | "open"
  | "paid"
  | "failed"
  | "expired"
  | "canceled"
  | "refunded";

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
  customerEmail: string;
  phone: string;
  placedAt: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  channel: OrderChannel;
  fulfilment: Fulfilment;
  town: string;
  address: string;
  lines: AdminOrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  note?: string;
  assignedRiderId: string | null;
  assignedRiderName: string | null;
  /** Set once the status actually reaches "delivered" — null until then. */
  deliveredAt: string | null;
  /** When the payment landed — what the kitchen's "waiting for a decision" clock runs from. */
  paidAt: string | null;
  /** When the kitchen accepted it (new -> preparing). */
  acceptedAt: string | null;
  /** Money handed back through Mollie, in euros. */
  refunded: number;
  /** The slot the customer picked at checkout — "YYYY-MM-DD" + "HH:MM". */
  deliveryDate: string | null;
  deliverySlotStart: string | null;
  deliverySlotEnd: string | null;
}

/**
 * The one valid "next stage" from any given status — what both the admin
 * status control and a rider's dashboard offer as the primary action.
 * `null` means terminal (delivered/cancelled) — nowhere to advance to.
 */
export const NEXT_STATUS: Record<OrderStatus, OrderStatus | null> = {
  new: "preparing",
  preparing: "ready",
  ready: "on_the_way",
  on_the_way: "delivered",
  delivered: null,
  cancelled: null,
};

/**
 * Every transition that's legal from a status; `NEXT_STATUS` above is just
 * the first (the primary button). "Ready for delivery" is optional — the
 * food is done and waiting for the rider — so a kitchen that doesn't want
 * the extra tap can go straight from preparing to on the way.
 */
export const ALLOWED_NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["preparing"],
  preparing: ["ready", "on_the_way"],
  ready: ["on_the_way"],
  on_the_way: ["delivered"],
  delivered: [],
  cancelled: [],
};

/**
 * What a rider is allowed to move an order into themselves — picking it up
 * and handing it over. Accepting and preparing are kitchen decisions, so
 * riders don't get those transitions.
 */
export const RIDER_STATUSES: OrderStatus[] = ["on_the_way", "delivered"];

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
  /**
   * "registered" has a real row in `customers` (id is that row's uuid, safe
   * to link to /admin/customers/[id]). "guest" is synthesized from orders
   * with no customer_id, grouped by email — id is a `guest:<email>` token
   * that doesn't resolve anywhere, so guest rows aren't clickable.
   */
  accountType: "registered" | "guest";
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready for delivery",
  on_the_way: "On the way",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

/** For a rider — never the amount, just whether it's settled. */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  open: "Payment pending",
  paid: "Payment received",
  failed: "Payment failed",
  expired: "Payment expired",
  canceled: "Payment cancelled",
  refunded: "Refunded",
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
