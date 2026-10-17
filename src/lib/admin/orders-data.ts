import "server-only";
import { supabaseAdmin } from "@/lib/supabase/server";
import { fromCents } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import { listCategories, listItems } from "@/lib/admin/store";
import type {
  AdminCustomer,
  AdminNotification,
  AdminOrder,
  CustomerStatus,
  OrderStatus,
} from "@/lib/admin/order-types";
import { ALLOWED_NEXT, RIDER_STATUSES, isFutureDelivery } from "@/lib/admin/order-types";
import { after } from "next/server";
import { getOrderSummaryById } from "@/lib/orders";
import { notifyRefund, refundOrder } from "@/lib/refunds";
import { sendOrderStatusEmail } from "@/lib/email/order-status";
import { releaseDeliverySlot } from "@/lib/delivery-slots-data";
import { fetchLineExtras } from "@/lib/order-extras";

/**
 * Real orders, customers, dashboard and report data — replaces
 * `mock-data.ts`. Orders and customers are real Postgres tables (see
 * supabase/migrations/0002 and 0004), so this file queries them directly
 * rather than going through the JSON/Supabase store toggle, which only
 * ever covered the menu document.
 *
 * `"server-only"`: every function here uses the service-role client, which
 * must never reach a Client Component. Pages fetch once and pass the plain
 * result down as props — see DashboardView/ReportsView, which then do
 * their own client-side filtering/aggregation on that already-fetched
 * array so the dropdowns still feel instant, with no round-trip per click.
 */

interface OrderItemRow {
  id: string;
  name: string;
  item_slug: string;
  quantity: number;
  unit_price_cents: number;
  options: { optionLabel: string; priceCents: number }[] | null;
  instructions: string | null;
  line_total_cents: number;
}

interface OrderRow {
  id: string;
  reference: string;
  customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  fulfilment: "delivery" | "pickup";
  address_street: string | null;
  address_postcode: string | null;
  address_city: string | null;
  notes: string | null;
  channel: AdminOrder["channel"];
  channel_note: string | null;
  payment_method: AdminOrder["paymentMethod"];
  status: string;
  payment_status: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  created_at: string;
  delivered_at: string | null;
  paid_at: string | null;
  accepted_at: string | null;
  refunded_cents: number;
  delivery_date: string | null;
  delivery_slot_start: string | null;
  delivery_slot_end: string | null;
  order_items: OrderItemRow[];
  assigned_rider_id: string | null;
  assigned_rider: { name: string } | null;
}

const PICKUP_ADDRESS = `${siteConfig.address.street}, ${siteConfig.address.postalCode} ${siteConfig.address.city}`;

function mapOrder(row: OrderRow): AdminOrder {
  const fulfilment = row.fulfilment === "pickup" ? "takeaway" : "delivery";

  const lines = (row.order_items ?? []).map((item) => {
    const extrasCents = (item.options ?? []).reduce(
      (sum, o) => sum + o.priceCents,
      0
    );
    const extras = (item.options ?? []).map((o) => o.optionLabel);
    const suffix = [extras.join(", "), item.instructions]
      .filter(Boolean)
      .join(" — ");

    return {
      id: item.id,
      name: suffix ? `${item.name} (${suffix})` : item.name,
      baseName: item.name,
      slug: item.item_slug,
      quantity: item.quantity,
      // Baking extras into the unit price keeps quantity*unitPrice equal to
      // the stored line total — every consumer computes it that way rather
      // than reading a stored total, and there's no separate field for
      // extras in the shape they expect.
      unitPrice: fromCents(item.unit_price_cents + extrasCents),
    };
  });

  return {
    id: row.id,
    reference: row.reference,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    phone: row.customer_phone,
    placedAt: row.created_at,
    status: row.status as AdminOrder["status"],
    paymentStatus: row.payment_status as AdminOrder["paymentStatus"],
    channel: row.channel,
    channelNote: row.channel_note,
    paymentMethod: row.payment_method ?? "mollie",
    fulfilment,
    town: fulfilment === "delivery" ? (row.address_city ?? "—") : "Pickup",
    address:
      fulfilment === "delivery"
        ? `${row.address_street}, ${row.address_postcode} ${row.address_city}`
        : PICKUP_ADDRESS,
    lines,
    subtotal: fromCents(row.subtotal_cents),
    deliveryFee: fromCents(row.delivery_fee_cents),
    total: fromCents(row.total_cents),
    note: row.notes ?? undefined,
    assignedRiderId: row.assigned_rider_id,
    assignedRiderName: row.assigned_rider?.name ?? null,
    deliveredAt: row.delivered_at,
    paidAt: row.paid_at,
    acceptedAt: row.accepted_at,
    refunded: fromCents(row.refunded_cents ?? 0),
    deliveryDate: row.delivery_date,
    deliverySlotStart: row.delivery_slot_start,
    deliverySlotEnd: row.delivery_slot_end,
  };
}

// The embed names its foreign key: `orders` has two links to `admin_users` (the
// assigned rider, and `created_by` for manual orders), and PostgREST refuses to
// guess which one a bare `admin_users(...)` means — every order query would fail.
const ORDER_SELECT =
  "id, reference, customer_id, customer_name, customer_email, customer_phone, fulfilment, address_street, address_postcode, address_city, notes, channel, channel_note, payment_method, status, payment_status, subtotal_cents, delivery_fee_cents, total_cents, created_at, delivered_at, paid_at, accepted_at, refunded_cents, delivery_date, delivery_slot_start, delivery_slot_end, assigned_rider_id, assigned_rider:admin_users!orders_assigned_rider_id_fkey(name), order_items(id, name, item_slug, quantity, unit_price_cents, options, instructions, line_total_cents)";

/**
 * Every order, newest first. A single kitchen's order volume stays small
 * enough for a while that fetching everything and filtering/sorting in
 * memory (here and in the client tables) is simpler than paginating —
 * worth revisiting once that stops being true.
 */
export async function listOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOrder(row as unknown as OrderRow));
}

export async function getOrder(id: string): Promise<AdminOrder | null> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  // One order, shown whole: add what staff changed on its lines (a swapped dish, the
  // regular price behind a compensation). Lists of orders skip this.
  const order = mapOrder(data as unknown as OrderRow);
  const extras = await fetchLineExtras(order.id);
  if (extras.size === 0) return order;
  return {
    ...order,
    lines: order.lines.map((l) => {
      const extra = l.id ? extras.get(l.id) : undefined;
      return extra
        ? {
            ...l,
            replaces: extra.replaces,
            listUnitPrice:
              extra.listUnitPriceCents != null ? fromCents(extra.listUnitPriceCents) : null,
          }
        : l;
    }),
  };
}

/** Every order assigned to this rider, newest first — their dashboard's whole feed. */
export async function listOrdersForRider(riderId: string): Promise<AdminOrder[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("assigned_rider_id", riderId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOrder(row as unknown as OrderRow));
}

/**
 * The only place an order's status can change. Never trust a status handed
 * in from the client (same rule as `priceCart()`) — this re-derives what's
 * actually allowed from the current row and the actor's role:
 *
 * - Owner/staff/manager can advance any order along `ALLOWED_NEXT`.
 * - A rider can only move an order that's assigned to them, and only
 *   into `RIDER_STATUSES` (kitchen owns accepting and preparing).
 *
 * Anything else — wrong actor, wrong order, wrong transition — throws
 * rather than silently no-opping, so a bug here fails loudly.
 */
export async function updateOrderStatus(
  orderId: string,
  nextStatus: OrderStatus,
  actor: { id: string; role: "owner" | "staff" | "manager" | "rider" | "kitchen" }
): Promise<void> {
  const { data: row, error: fetchError } = await supabaseAdmin()
    .from("orders")
    .select("status, assigned_rider_id, delivery_date")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Order not found.");

  const currentStatus = row.status as OrderStatus;

  // Accepting an order for a later day doesn't start the cooking: it is
  // *scheduled*, and becomes "preparing" when the kitchen starts it on the day.
  // Decided here, once, so every screen that accepts (the popup, the kitchen
  // board, the order page) gets it right without each having to remember.
  if (currentStatus === "new" && nextStatus === "preparing" && isFutureDelivery(row.delivery_date)) {
    nextStatus = "scheduled";
  }

  if (!ALLOWED_NEXT[currentStatus].includes(nextStatus)) {
    throw new Error(`Can't move an order from "${currentStatus}" to "${nextStatus}".`);
  }

  // The kitchen accepts an order, starts a scheduled one and marks it ready —
  // nothing further. Handing it to a rider, delivering it, cancelling or
  // refunding it are not its job.
  if (
    actor.role === "kitchen" &&
    nextStatus !== "preparing" &&
    nextStatus !== "scheduled" &&
    nextStatus !== "ready"
  ) {
    throw new Error("The kitchen can only accept an order, start it or mark it ready.");
  }

  if (actor.role === "rider") {
    if (row.assigned_rider_id !== actor.id) {
      throw new Error("This order isn't assigned to you.");
    }
    if (!RIDER_STATUSES.includes(nextStatus)) {
      throw new Error("Riders can't make that change.");
    }
  }

  // `accepted_at` is when the kitchen first said yes — new -> preparing or
  // scheduled — and is never overwritten when a scheduled order later starts.
  const accepting = currentStatus === "new" && (nextStatus === "preparing" || nextStatus === "scheduled");
  const patch = {
    status: nextStatus,
    ...(nextStatus === "delivered" ? { delivered_at: new Date().toISOString() } : {}),
    ...(accepting ? { accepted_at: new Date().toISOString() } : {}),
  };
  let { error } = await supabaseAdmin().from("orders").update(patch).eq("id", orderId);

  // Migration 0020 widens the status check to allow "scheduled". Until it has
  // been run the database refuses the new value; accepting an order must still
  // work, so fall back to the old behaviour and say so in the log.
  if (error && nextStatus === "scheduled" && error.code === "23514") {
    console.error("[orders] status 'scheduled' refused by the database - run migration 0020. Falling back to 'preparing'.");
    nextStatus = "preparing";
    ({ error } = await supabaseAdmin()
      .from("orders")
      .update({ ...patch, status: "preparing" })
      .eq("id", orderId));
  }
  if (error) throw new Error(error.message);

  // Tell the customer. "Ready for delivery" is an internal step, so it
  // doesn't get an email; neither does starting a scheduled order (they were
  // told when it was accepted). after() keeps the send alive on Vercel without
  // holding up the click.
  const emailKind =
    nextStatus === "scheduled"
      ? "scheduled"
      : nextStatus === "preparing" && currentStatus === "new"
        ? "preparing"
        : nextStatus === "on_the_way" || nextStatus === "delivered"
          ? nextStatus
          : null;
  if (emailKind) {
    const order = await getOrderSummaryById(orderId);
    if (order) after(() => sendOrderStatusEmail(order, emailKind));
  }
}

/**
 * Owner/staff/manager only — the "Decline" side of the new-order popup,
 * and available generally for cancelling a live order. Not part of
 * `NEXT_STATUS`'s linear chain (cancelling isn't "the next stage"), so it
 * gets its own function rather than being squeezed into `updateOrderStatus`.
 */
export interface CancelResult {
  /** Cents sent back to the customer (0 when the order was never paid). */
  refundedCents: number;
  /** Set when the order was cancelled but the refund could not be made. */
  refundError?: string;
  /** Set when there was nothing to refund automatically (paid by cash or transfer). */
  refundNote?: string;
}

export async function cancelOrder(
  orderId: string,
  actor: { role: "owner" | "staff" | "manager"; id?: string }
): Promise<CancelResult> {
  if (actor.role !== "owner" && actor.role !== "staff" && actor.role !== "manager") {
    throw new Error("Only staff can cancel an order.");
  }

  const { data: row, error: fetchError } = await supabaseAdmin()
    .from("orders")
    .select("status, payment_status, payment_method, delivery_date, delivery_slot_start")
    .eq("id", orderId)
    .maybeSingle();

  if (fetchError) throw new Error(fetchError.message);
  if (!row) throw new Error("Order not found.");
  if (row.status === "delivered" || row.status === "cancelled") {
    throw new Error(`Can't cancel an order that's already "${row.status}".`);
  }

  const { error } = await supabaseAdmin()
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);

  if (error) throw new Error(error.message);

  // Give the seat back — a cancelled order shouldn't go on shrinking that
  // slot's real capacity for everyone else.
  await releaseDeliverySlot(row.delivery_date, row.delivery_slot_start);

  // The customer already paid for something we're not going to make — the
  // money goes back automatically rather than leaving a cancelled order
  // sitting on a payment nobody remembers to refund.
  const result: CancelResult = { refundedCents: 0 };
  if (row.payment_status === "paid" && row.payment_method !== "mollie") {
    result.refundNote =
      "It wasn't paid online, so nothing was refunded automatically — give the money back yourself.";
  } else if (row.payment_status === "paid") {
    // Whatever is still refundable goes back (some may already have been
    // refunded in part), and the customer gets a credit note for it.
    const refund = await refundOrder(orderId, { createdBy: actor.id ?? null });
    if (refund.ok) {
      result.refundedCents = refund.refundedCents;
      await notifyRefund(orderId, refund, "cancelled");
      return result;
    }
    result.refundError = refund.message;
  }

  const order = await getOrderSummaryById(orderId);
  if (order) {
    const refunded = result.refundedCents;
    after(() => sendOrderStatusEmail(order, "cancelled", refunded));
  }
  return result;
}

/**
 * Orders waiting on a kitchen decision — paid, but not yet accepted or
 * declined. This is exactly what the new-order popup polls: once an order
 * is accepted (-> preparing) or declined (-> cancelled) it naturally drops
 * out of this list, so there's no separate "seen" flag to maintain.
 */
export async function listPendingOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .eq("status", "new")
    .eq("payment_status", "paid")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOrder(row as unknown as OrderRow));
}

/**
 * What the kitchen board shows: orders someone has to cook right now. A paid
 * order nobody has accepted yet; and anything already accepted (preparing or
 * ready for the rider) — including an order staff entered by phone that is
 * still to be paid in cash. A checkout that was started and never paid is not
 * an order yet and never appears.
 */
export async function listKitchenOrders(): Promise<AdminOrder[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .or(
      "and(status.eq.new,payment_status.eq.paid),and(status.in.(scheduled,preparing,ready),payment_status.in.(paid,open))"
    )
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapOrder(row as unknown as OrderRow));
}

/**
 * Anything that finished or is out of the kitchen's hands: on its way, delivered
 * or cancelled — newest delivery first. For the kitchen's History screen, so the
 * cooks can look up what went out on a given day (or find a particular order).
 *
 * `from`/`to` are Amsterdam calendar days ("YYYY-MM-DD", inclusive). An order
 * belongs to the day it was booked for; one with no set day, to the day it was
 * placed. At most `limit` rows come back.
 */
export async function listKitchenHistory(opts: {
  from: string;
  to: string;
  limit?: number;
}): Promise<AdminOrder[]> {
  const limit = opts.limit ?? 300;
  const finished = ["on_the_way", "delivered", "cancelled"];

  // Booked for a day in range...
  const booked = supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", finished)
    .gte("delivery_date", opts.from)
    .lte("delivery_date", opts.to)
    .limit(limit);

  // ...or placed in range with no day booked. Created-at is a UTC instant, so
  // the query is widened by a day each side and trimmed to Amsterdam days below.
  const dayMs = 86_400_000;
  const loose = supabaseAdmin()
    .from("orders")
    .select(ORDER_SELECT)
    .in("status", finished)
    .is("delivery_date", null)
    .gte("created_at", new Date(Date.parse(`${opts.from}T00:00:00Z`) - dayMs).toISOString())
    .lte("created_at", new Date(Date.parse(`${opts.to}T00:00:00Z`) + 2 * dayMs).toISOString())
    .limit(limit);

  const [a, b] = await Promise.all([booked, loose]);
  if (a.error) throw new Error(a.error.message);
  if (b.error) throw new Error(b.error.message);

  const dayOf = (iso: string) =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Amsterdam",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));

  const rows = [...(a.data ?? []), ...(b.data ?? [])]
    .map((row) => mapOrder(row as unknown as OrderRow))
    .filter((o) => {
      const day = o.deliveryDate ?? dayOf(o.placedAt);
      return day >= opts.from && day <= opts.to;
    });

  const key = (o: AdminOrder) =>
    `${o.deliveryDate ?? dayOf(o.placedAt)} ${o.deliverySlotStart ?? "00:00"} ${o.placedAt}`;
  return rows.sort((x, y) => key(y).localeCompare(key(x))).slice(0, limit);
}

/** Owner/staff/manager/kitchen — assigning `null` unassigns. */
export async function assignRider(
  orderId: string,
  riderId: string | null
): Promise<void> {
  // Only a real rider can be assigned (a form value is not to be trusted).
  if (riderId) {
    const { data: rider, error: riderError } = await supabaseAdmin()
      .from("admin_users")
      .select("id")
      .eq("id", riderId)
      .eq("role", "rider")
      .maybeSingle();
    if (riderError) throw new Error(riderError.message);
    if (!rider) throw new Error("That isn't a rider.");
  }

  const { error } = await supabaseAdmin()
    .from("orders")
    .update({ assigned_rider_id: riderId })
    .eq("id", orderId);

  if (error) throw new Error(error.message);
}

/* ------------------------------------------------------------- customers */

interface CustomerRow {
  id: string;
  name: string;
  phone: string | null;
  email: string;
  created_at: string;
}

/** Active = ordered in the last 60 days; new = never ordered yet. */
function deriveCustomerStatus(
  orderCount: number,
  lastOrderAt: string | null
): CustomerStatus {
  if (orderCount === 0 || !lastOrderAt) return "new";
  const daysSince = (Date.now() - Date.parse(lastOrderAt)) / 86_400_000;
  return daysSince <= 60 ? "active" : "lapsed";
}

function buildCustomers(
  rows: CustomerRow[],
  orders: AdminOrder[]
): AdminCustomer[] {
  const byCustomer = new Map<string, AdminOrder[]>();
  for (const order of orders) {
    if (!order.customerId) continue;
    const list = byCustomer.get(order.customerId) ?? [];
    list.push(order);
    byCustomer.set(order.customerId, list);
  }

  return rows.map((row) => {
    const own = [...(byCustomer.get(row.id) ?? [])].sort(
      (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt)
    );
    const delivered = own.filter((o) => o.fulfilment === "delivery");
    const lastOrder = own[0] ?? null;
    const totalSpent = own.reduce(
      (sum, o) => sum + (o.status === "cancelled" ? 0 : o.total),
      0
    );

    const dishCounts = new Map<string, number>();
    for (const order of own) {
      for (const line of order.lines) {
        dishCounts.set(line.name, (dishCounts.get(line.name) ?? 0) + line.quantity);
      }
    }
    const favouriteDish =
      [...dishCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    const whatsappCount = own.filter((o) => o.channel === "whatsapp").length;

    return {
      id: row.id,
      name: row.name,
      phone: row.phone ?? "—",
      email: row.email,
      town: delivered[0]?.town ?? "—",
      address: delivered[0]?.address ?? "—",
      joinedAt: row.created_at,
      lastOrderAt: lastOrder?.placedAt ?? null,
      orderCount: own.length,
      totalSpent,
      favouriteDish,
      preferredChannel: topChannel(own),
      status: deriveCustomerStatus(own.length, lastOrder?.placedAt ?? null),
      accountType: "registered",
    };
  });
}

/** The channel most of someone's orders came through. */
function topChannel(orders: AdminOrder[]): AdminOrder["channel"] {
  const counts = new Map<AdminOrder["channel"], number>();
  for (const o of orders) counts.set(o.channel, (counts.get(o.channel) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "website";
}

/**
 * Guest checkouts never created an account, so they have no row in
 * `customers` — only their orders exist, grouped here by email. Synthetic
 * id (`guest:<email>`) doesn't resolve to a real record anywhere, which is
 * the signal CustomersTable uses to not link the row.
 */
function buildGuestCustomers(orders: AdminOrder[]): AdminCustomer[] {
  const byEmail = new Map<string, AdminOrder[]>();
  for (const order of orders) {
    if (order.customerId) continue;
    const email = order.customerEmail?.trim().toLowerCase();
    // An order staff entered by phone may have no email: group those by
    // phone number instead, so a regular caller still shows up as one person.
    const key = email || `tel:${order.phone.replace(/\D/g, "")}`;
    if (key === "tel:") continue;
    const list = byEmail.get(key) ?? [];
    list.push(order);
    byEmail.set(key, list);
  }

  return [...byEmail.entries()].map(([key, own]) => {
    const sorted = [...own].sort(
      (a, b) => Date.parse(b.placedAt) - Date.parse(a.placedAt)
    );
    const delivered = sorted.filter((o) => o.fulfilment === "delivery");
    const lastOrder = sorted[0];
    const totalSpent = sorted.reduce(
      (sum, o) => sum + (o.status === "cancelled" ? 0 : o.total),
      0
    );

    const dishCounts = new Map<string, number>();
    for (const order of sorted) {
      for (const line of order.lines) {
        dishCounts.set(line.name, (dishCounts.get(line.name) ?? 0) + line.quantity);
      }
    }
    const favouriteDish =
      [...dishCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

    return {
      id: `guest:${key}`,
      name: lastOrder.customerName,
      phone: lastOrder.phone,
      email: key.startsWith("tel:") ? "" : key,
      town: delivered[0]?.town ?? "—",
      address: delivered[0]?.address ?? "—",
      joinedAt: sorted[sorted.length - 1].placedAt,
      lastOrderAt: lastOrder.placedAt,
      orderCount: sorted.length,
      totalSpent,
      favouriteDish,
      preferredChannel: topChannel(sorted),
      status: deriveCustomerStatus(sorted.length, lastOrder.placedAt),
      accountType: "guest",
    };
  });
}

export async function listCustomers(): Promise<AdminCustomer[]> {
  const [{ data, error }, orders] = await Promise.all([
    supabaseAdmin()
      .from("customers")
      .select("id, name, phone, email, created_at"),
    listOrders(),
  ]);

  if (error) throw new Error(error.message);
  return [
    ...buildCustomers((data ?? []) as CustomerRow[], orders),
    ...buildGuestCustomers(orders),
  ];
}

export async function getCustomer(id: string): Promise<AdminCustomer | null> {
  const [{ data, error }, orders] = await Promise.all([
    supabaseAdmin()
      .from("customers")
      .select("id, name, phone, email, created_at")
      .eq("id", id)
      .maybeSingle(),
    listOrders(),
  ]);

  if (error) throw new Error(error.message);
  if (!data) return null;
  return buildCustomers([data as CustomerRow], orders)[0];
}

export function ordersForCustomer(
  orders: AdminOrder[],
  customerId: string
): AdminOrder[] {
  return orders.filter((o) => o.customerId === customerId);
}

/** Today's slug -> category label, for getSalesByCategory. */
export async function getCategoryByDish(): Promise<Map<string, string>> {
  const [items, categories] = await Promise.all([listItems(), listCategories()]);
  const labelById = new Map(categories.map((c) => [c.id, c.label]));
  return new Map(items.map((i) => [i.slug, labelById.get(i.categoryId) ?? "Other"]));
}

/* --------------------------------------------------------- notifications */

/**
 * There's no real events log yet — no inventory system for "stock running
 * low", no review integration. Rather than invent those the way the mock
 * data did, notifications are built only from the one real signal that
 * exists: recent orders.
 */
export async function getRecentNotifications(): Promise<AdminNotification[]> {
  const { data, error } = await supabaseAdmin()
    .from("orders")
    .select("id, reference, customer_name, status, total_cents, created_at")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) throw new Error(error.message);

  const now = Date.now();

  return (data ?? []).map((row) => {
    const minutesAgo = Math.max(
      0,
      Math.round((now - Date.parse(row.created_at)) / 60_000)
    );
    const cancelled = row.status === "cancelled";

    return {
      id: row.id,
      kind: "order" as const,
      title: cancelled
        ? `Order cancelled — ${row.reference}`
        : `New order from ${row.customer_name}`,
      body: cancelled
        ? `€ ${fromCents(row.total_cents).toFixed(2)}`
        : `${row.reference} · € ${fromCents(row.total_cents).toFixed(2)}`,
      minutesAgo,
      read: minutesAgo > 60,
      href: "/admin/orders",
    };
  });
}
