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
} from "@/lib/admin/order-types";

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
  channel: "website" | "whatsapp";
  status: string;
  subtotal_cents: number;
  delivery_fee_cents: number;
  total_cents: number;
  created_at: string;
  order_items: OrderItemRow[];
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
    channel: row.channel,
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
  };
}

const ORDER_SELECT =
  "id, reference, customer_id, customer_name, customer_email, customer_phone, fulfilment, address_street, address_postcode, address_city, notes, channel, status, subtotal_cents, delivery_fee_cents, total_cents, created_at, order_items(name, item_slug, quantity, unit_price_cents, options, instructions, line_total_cents)";

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
  return data ? mapOrder(data as unknown as OrderRow) : null;
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
      preferredChannel: whatsappCount > own.length / 2 ? "whatsapp" : "website",
      status: deriveCustomerStatus(own.length, lastOrder?.placedAt ?? null),
      accountType: "registered",
    };
  });
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
    if (!email) continue;
    const list = byEmail.get(email) ?? [];
    list.push(order);
    byEmail.set(email, list);
  }

  return [...byEmail.entries()].map(([email, own]) => {
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

    const whatsappCount = sorted.filter((o) => o.channel === "whatsapp").length;

    return {
      id: `guest:${email}`,
      name: lastOrder.customerName,
      phone: lastOrder.phone,
      email,
      town: delivered[0]?.town ?? "—",
      address: delivered[0]?.address ?? "—",
      joinedAt: sorted[sorted.length - 1].placedAt,
      lastOrderAt: lastOrder.placedAt,
      orderCount: sorted.length,
      totalSpent,
      favouriteDish,
      preferredChannel: whatsappCount > sorted.length / 2 ? "whatsapp" : "website",
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
