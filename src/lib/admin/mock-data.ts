/**
 * ⚠️ EVERY PIECE OF FAKE DATA IN THE ADMIN PANEL LIVES IN THIS FILE.
 *
 * Nothing else under src/app/admin or src/components/admin invents numbers.
 * When the real backend lands, delete this file and point the same exported
 * names at Supabase queries — the components consuming them won't change.
 *
 * Values are generated from a fixed seed rather than Math.random() so server
 * and client render identical output (random values would cause hydration
 * mismatches and make the charts jump on every navigation).
 */

import { siteConfig } from "@/lib/site-config";

/* ------------------------------------------------------------------ helpers */

/** Deterministic PRNG (mulberry32) — same sequence every run. */
function seeded(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function series(count: number, seed: number, min: number, max: number, trend = 0) {
  const rand = seeded(seed);
  return Array.from({ length: count }, (_, i) => {
    const drift = (i / Math.max(1, count - 1)) * trend;
    return Math.round(min + rand() * (max - min) + drift);
  });
}

/* ------------------------------------------------------------------- types */

export type OrderStatus =
  | "new"
  | "preparing"
  | "on-the-way"
  | "delivered"
  | "cancelled";

export type OrderChannel = "whatsapp" | "website";
export type Fulfilment = "delivery" | "takeaway";

export interface MockOrderLine {
  name: string;
  quantity: number;
  unitPrice: number;
}

export interface MockOrder {
  id: string;
  reference: string;
  customerId: string;
  customerName: string;
  phone: string;
  placedAt: string;
  status: OrderStatus;
  channel: OrderChannel;
  fulfilment: Fulfilment;
  town: string;
  address: string;
  lines: MockOrderLine[];
  subtotal: number;
  deliveryFee: number;
  total: number;
  note?: string;
}

export type CustomerStatus = "new" | "active" | "lapsed";

export interface MockCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  town: string;
  address: string;
  postalCode: string;
  joinedAt: string;
  lastOrderAt: string;
  orderCount: number;
  totalSpent: number;
  favouriteDish: string;
  preferredChannel: OrderChannel;
  status: CustomerStatus;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  new: "New",
  preparing: "Preparing",
  "on-the-way": "On the way",
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

/* --------------------------------------------------------------- customers */

const CUSTOMER_SEEDS: {
  name: string;
  town: string;
  street: string;
  status: CustomerStatus;
  channel: OrderChannel;
  dish: string;
}[] = [
  { name: "Muhammed Fateh", town: "Hoogkarspel", street: "Streekweg 112", status: "active", channel: "whatsapp", dish: "Chicken Biryani" },
  { name: "Sanne de Vries", town: "Bovenkarspel", street: "Hoofdstraat 47", status: "active", channel: "website", dish: "Zinger Burger" },
  { name: "Mukarram Kazi", town: "Grootebroek", street: "Zesstedenweg 210", status: "active", channel: "whatsapp", dish: "Chicken Biryani" },
  { name: "Lotte Jansen", town: "Lutjebroek", street: "Vekenweg 8", status: "new", channel: "website", dish: "Garlic Naan" },
  { name: "Muhammad Khan", town: "Enkhuizen", street: "Westerstraat 74", status: "active", channel: "whatsapp", dish: "Chicken Shoarma" },
  { name: "Daan Bakker", town: "Hoorn", street: "Grote Noord 31", status: "lapsed", channel: "website", dish: "Shami Burger" },
  { name: "Ayesha Malik", town: "Westwoud", street: "Dr. Nuijensstraat 19", status: "active", channel: "whatsapp", dish: "Chicken Chapli Kebab" },
  { name: "Tim Visser", town: "Wognum", street: "Kerkstraat 55", status: "active", channel: "website", dish: "Veg Samosa" },
  { name: "Fatima Noor", town: "Wervershoof", street: "Simon Koopmanstraat 3", status: "new", channel: "whatsapp", dish: "Qeema Naan" },
  { name: "Bram Smit", town: "Midwoud", street: "Oosteinde 22", status: "lapsed", channel: "website", dish: "Fried Wings" },
  { name: "Zainab Hussain", town: "Nibbixwoud", street: "Dorpsstraat 91", status: "active", channel: "whatsapp", dish: "Chicken Biryani" },
  { name: "Eva Mulder", town: "Oosterblokker", street: "Blokkerweg 5", status: "active", channel: "website", dish: "Chicken Shoarma" },
  { name: "Imran Sheikh", town: "Zwaagdijk-Oost", street: "Zwaagdijk 143", status: "active", channel: "whatsapp", dish: "Kebab Masala / Curry" },
  { name: "Julia Bos", town: "Hoogkarspel", street: "Raadhuisplein 12", status: "new", channel: "website", dish: "Milk Shake" },
];

export const customers: MockCustomer[] = CUSTOMER_SEEDS.map((seed, i) => {
  const rand = seeded(100 + i);
  const orderCount =
    seed.status === "new"
      ? 1 + Math.floor(rand() * 2)
      : seed.status === "lapsed"
        ? 3 + Math.floor(rand() * 5)
        : 6 + Math.floor(rand() * 22);
  const avg = 22 + rand() * 28;

  return {
    id: `cus-${String(i + 1).padStart(3, "0")}`,
    name: seed.name,
    phone: `+316 ${String(10000000 + Math.floor(rand() * 89999999)).slice(0, 8)}`,
    email: `${seed.name.toLowerCase().replace(/[^a-z]+/g, ".")}@example.nl`,
    town: seed.town,
    address: seed.street,
    postalCode: `16${10 + i} ${String.fromCharCode(65 + i)}${String.fromCharCode(72 + (i % 8))}`,
    joinedAt: `2024-${String(1 + (i % 9)).padStart(2, "0")}-${String(3 + (i % 24)).padStart(2, "0")}`,
    lastOrderAt:
      seed.status === "lapsed"
        ? `2024-08-${String(4 + (i % 20)).padStart(2, "0")}`
        : `2024-12-${String(8 + (i % 14)).padStart(2, "0")}`,
    orderCount,
    totalSpent: Math.round(orderCount * avg * 100) / 100,
    favouriteDish: seed.dish,
    preferredChannel: seed.channel,
    status: seed.status,
  };
});

export function findCustomer(id: string) {
  return customers.find((c) => c.id === id);
}

/* ------------------------------------------------------------------ orders */

const DISH_PRICES: { name: string; price: number }[] = [
  { name: "Chicken Biryani", price: 13.5 },
  { name: "Kebab Masala / Curry", price: 14.75 },
  { name: "Vegetable Chinese Rice", price: 10.5 },
  { name: "Chicken Chapli Kebab", price: 6.25 },
  { name: "Chicken Shami Kebab", price: 5.75 },
  { name: "Chicken Shoarma", price: 9.5 },
  { name: "Zinger Burger", price: 8.75 },
  { name: "Shami Burger", price: 7.5 },
  { name: "Garlic Naan", price: 3.25 },
  { name: "Qeema Naan", price: 4.5 },
  { name: "Veg Samosa", price: 2.5 },
  { name: "Fried Wings", price: 7.25 },
  { name: "Homemade Special Fries", price: 4.75 },
  { name: "Milk Shake", price: 4.5 },
];

const STATUS_CYCLE: OrderStatus[] = [
  "delivered", "delivered", "delivered", "on-the-way", "preparing",
  "delivered", "new", "delivered", "cancelled", "delivered",
  "delivered", "preparing", "delivered", "on-the-way", "delivered",
  "new", "delivered", "delivered", "cancelled", "delivered",
  "preparing", "delivered", "delivered", "new",
];

export const orders: MockOrder[] = STATUS_CYCLE.map((status, i) => {
  const rand = seeded(500 + i);
  const customer = customers[i % customers.length];
  const lineCount = 1 + Math.floor(rand() * 4);

  const lines: MockOrderLine[] = Array.from({ length: lineCount }, () => {
    const dish = DISH_PRICES[Math.floor(rand() * DISH_PRICES.length)];
    return {
      name: dish.name,
      quantity: 1 + Math.floor(rand() * 3),
      unitPrice: dish.price,
    };
  });

  const subtotal =
    Math.round(
      lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0) * 100
    ) / 100;
  const fulfilment: Fulfilment = rand() > 0.28 ? "delivery" : "takeaway";
  const deliveryFee = fulfilment === "delivery" ? 2.5 : 0;

  const day = 22 - Math.floor(i / 2);
  const hour = 11 + (i % 10);

  return {
    id: `ord-${String(i + 1).padStart(4, "0")}`,
    reference: `#KB-${26839000 + i * 37}`,
    customerId: customer.id,
    customerName: customer.name,
    phone: customer.phone,
    placedAt: `2024-12-${String(Math.max(1, day)).padStart(2, "0")}T${String(hour).padStart(2, "0")}:${String(5 + ((i * 7) % 50)).padStart(2, "0")}:00`,
    status,
    channel: customer.preferredChannel,
    fulfilment,
    town: customer.town,
    address: `${customer.address}, ${customer.postalCode} ${customer.town}`,
    lines,
    subtotal,
    deliveryFee,
    total: Math.round((subtotal + deliveryFee) * 100) / 100,
    note:
      i % 6 === 0
        ? "Extra spicy please, and ring the bell twice."
        : i % 9 === 0
          ? "No coriander."
          : undefined,
  };
});

export function findOrder(id: string) {
  return orders.find((o) => o.id === id);
}

export function ordersForCustomer(customerId: string) {
  return orders.filter((o) => o.customerId === customerId);
}

/* ------------------------------------------------------- dashboard filters */

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

const PERIOD_LABELS_X: Record<Period, string[]> = {
  daily: Array.from({ length: 14 }, (_, i) => `${i + 9} Dec`),
  weekly: ["W40", "W41", "W42", "W43", "W44", "W45", "W46", "W47", "W48", "W49", "W50", "W51"],
  monthly: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** Chart series keyed by the two dashboard dropdowns. */
export function getOrderAnalytics(status: StatusFilter, period: Period) {
  const labels = PERIOD_LABELS_X[period];
  const n = labels.length;

  const scale =
    status === "all" ? 1 : status === "delivered" ? 0.82 : status === "preparing" ? 0.12 : 0.06;
  const seed = n * 13 + status.length * 7;

  const current = series(n, seed, 900 * scale, 2400 * scale, 600 * scale);
  const previous = series(n, seed + 99, 700 * scale, 1900 * scale, 300 * scale);

  const total = current.reduce((a, b) => a + b, 0);
  const prevTotal = previous.reduce((a, b) => a + b, 0);

  return {
    labels,
    current,
    previous,
    total,
    delta: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0,
  };
}

export function getRevenueProfile(period: Period) {
  const labels = PERIOD_LABELS_X[period];
  const n = labels.length;
  const points = series(n, n * 31, 8000, 24000, 26000);
  const previous = series(n, n * 31 + 57, 7200, 21000, 20000);

  // Total is the revenue *across* the period, and the delta compares it to
  // the equivalent previous period — comparing first vs last point of a
  // rising series produced a meaningless "+247%".
  const total = points.reduce((a, b) => a + b, 0);
  const prevTotal = previous.reduce((a, b) => a + b, 0);

  return {
    labels,
    points,
    total,
    delta: prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : 0,
  };
}

/* --------------------------------------------------------------- dashboard */

export function getSummaryStats(period: Period) {
  const analytics = getOrderAnalytics("all", period);
  const revenue = getRevenueProfile(period);

  return [
    {
      label: "Total Orders",
      value: analytics.total.toLocaleString("en-US"),
      delta: analytics.delta,
    },
    {
      label: "Total Revenue",
      value: `€ ${Math.round(revenue.total).toLocaleString("en-GB")}`,
      delta: revenue.delta,
    },
    {
      label: "New Customers",
      value: String(customers.filter((c) => c.status === "new").length * 24),
      delta: -15,
    },
  ];
}

export function getOrderPerformance() {
  const total = orders.length;
  const pct = (s: OrderStatus[]) =>
    Math.round(
      (orders.filter((o) => s.includes(o.status)).length / total) * 100
    );

  return [
    { label: "Orders Completed", value: pct(["delivered"]), tone: "success" as const },
    { label: "In Progress", value: pct(["new", "preparing", "on-the-way"]), tone: "warn" as const },
    { label: "Orders Cancelled", value: pct(["cancelled"]), tone: "danger" as const },
  ];
}

/* ----------------------------------------------------------- notifications */

export type NotificationKind = "order" | "review" | "stock" | "system";

export interface MockNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  /** Minutes ago — rendered relatively so it never looks stale. */
  minutesAgo: number;
  read: boolean;
  href?: string;
}

export const notifications: MockNotification[] = [
  {
    id: "n1",
    kind: "order",
    title: "New order from Julia Bos",
    body: "3 items · € 26.75 · Website",
    minutesAgo: 4,
    read: false,
    href: "/admin/orders",
  },
  {
    id: "n2",
    kind: "order",
    title: "Order #KB-26839407 is ready",
    body: "Waiting for the driver",
    minutesAgo: 18,
    read: false,
    href: "/admin/orders",
  },
  {
    id: "n3",
    kind: "stock",
    title: "Basmati rice running low",
    body: "Under 5 kg left at current usage",
    minutesAgo: 52,
    read: false,
    href: "/admin/menu/ingredients",
  },
  {
    id: "n4",
    kind: "review",
    title: "New 5-star review",
    body: "“Best biryani in West-Friesland.”",
    minutesAgo: 140,
    read: true,
  },
  {
    id: "n5",
    kind: "order",
    title: "Order cancelled",
    body: "#KB-26839296 · € 54.50 refunded",
    minutesAgo: 320,
    read: true,
    href: "/admin/orders",
  },
  {
    id: "n6",
    kind: "system",
    title: "Menu prices still unset",
    body: "21 dishes show “price on request”",
    minutesAgo: 1450,
    read: true,
    href: "/admin/menu",
  },
];

/** "4 min ago", "3 h ago", "2 d ago" */
export function relativeTime(minutesAgo: number): string {
  if (minutesAgo < 60) return `${minutesAgo} min ago`;
  if (minutesAgo < 1440) return `${Math.round(minutesAgo / 60)} h ago`;
  return `${Math.round(minutesAgo / 1440)} d ago`;
}

/* ----------------------------------------------------------------- reports */

export function getRevenueByMonth() {
  const labels = PERIOD_LABELS_X.monthly;
  return labels.map((label, i) => ({
    label,
    revenue: series(12, 777, 9000, 21000, 14000)[i],
    orders: series(12, 421, 380, 900, 420)[i],
  }));
}

export function getSalesByCategory() {
  return [
    { label: "Main Dishes", value: 38, revenue: 41200 },
    { label: "Fast Food & Wraps", value: 24, revenue: 26100 },
    { label: "Kebabs & Starters", value: 18, revenue: 19500 },
    { label: "Breads", value: 11, revenue: 11900 },
    { label: "Desserts & Drinks", value: 6, revenue: 6500 },
    { label: "Specialties & Sides", value: 3, revenue: 3250 },
  ];
}

export function getTopDishes() {
  return [
    { name: "Chicken Biryani", orders: 486, revenue: 6561 },
    { name: "Chicken Shoarma", orders: 372, revenue: 3534 },
    { name: "Zinger Burger", orders: 341, revenue: 2984 },
    { name: "Garlic Naan", orders: 298, revenue: 968 },
    { name: "Chicken Chapli Kebab", orders: 214, revenue: 1338 },
    { name: "Qeema Naan", orders: 187, revenue: 842 },
  ];
}

export function getOrdersByTown() {
  const towns = siteConfig.deliveryAreaTowns.slice(0, 8);
  const values = series(towns.length, 909, 40, 320, 120);
  return towns
    .map((town, i) => ({ label: town, value: values[i] }))
    .sort((a, b) => b.value - a.value);
}

export function getOrdersByHour() {
  // Two service peaks — lunch and a bigger dinner rush.
  const hours = Array.from({ length: 12 }, (_, i) => i + 11);
  return hours.map((hour) => {
    const lunch = Math.exp(-((hour - 13) ** 2) / 3) * 45;
    const dinner = Math.exp(-((hour - 19) ** 2) / 4) * 110;
    return { label: `${hour}:00`, value: Math.round(lunch + dinner + 8) };
  });
}

export function getChannelSplit() {
  const wa = orders.filter((o) => o.channel === "whatsapp").length;
  return [
    { label: "WhatsApp", value: Math.round((wa / orders.length) * 100) },
    { label: "Website", value: 100 - Math.round((wa / orders.length) * 100) },
  ];
}
