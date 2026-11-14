"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  Check,
  ChefHat,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Maximize2,
  Phone,
  Printer,
  StickyNote,
  Volume2,
  Wallet,
  WifiOff,
} from "lucide-react";
import { advanceKitchenOrderAction, assignKitchenRiderAction } from "@/app/kitchen/actions";
import { acceptTarget, isFutureDelivery } from "@/lib/admin/order-types";

export interface BoardOrder {
  id: string;
  reference: string;
  customerName: string;
  firstName: string;
  phone: string;
  address: string;
  town: string;
  assignedRiderId: string | null;
  assignedRiderName: string | null;
  status: "new" | "scheduled" | "preparing" | "ready" | "on_the_way" | "delivered";
  paymentStatus: string;
  paymentMethod: string;
  paidAt: string | null;
  acceptedAt: string | null;
  deliveredAt: string | null;
  placedAt: string;
  deliveryDate: string | null;
  slotStart: string | null;
  slotEnd: string | null;
  /** `details`: extras, or the dishes inside a deal, one per entry. */
  lines: { quantity: number; name: string; details?: string[]; instructions?: string | null }[];
  note: string | null;
}

export interface BoardRider {
  id: string;
  name: string;
}

const POLL_MS = 5000;
const BEEP_MS = 1800;
/** Seconds an unaccepted order may wait before the card turns amber, then red. */
const WARN_AFTER = 3 * 60;
const URGENT_AFTER = 5 * 60;

/** Auto-print: which device prints, what it has already printed, and how far back it looks. */
const AUTOPRINT_KEY = "kebabish-autoprint-v1";
const PRINTED_KEY = "kebabish-printed-v1";
/** Only orders accepted this recently are printed automatically — never a backlog. */
const PRINT_WINDOW_MS = 30 * 60_000;
/** Gap between two tickets, so the printer is never handed two at once. */
const PRINT_GAP_MS = 6000;

/** Two short tones — synthesised, so there is no audio file to host. */
function beep() {
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Blocked until the page has had a tap — the "turn on sound" banner covers that.
  }
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function dayLabel(deliveryDate: string, long = false): string {
  const [y, m, d] = deliveryDate.split("-").map(Number);
  return new Intl.DateTimeFormat("nl-NL", {
    weekday: long ? "long" : "short",
    day: "numeric",
    month: "short",
  }).format(new Date(y, m - 1, d));
}

/** "19:12" in Amsterdam, for a stored instant. */
function clockAt(iso: string): string {
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** The delivery window split in two, so a card can show the day above the time. */
function slotParts(o: BoardOrder): { day: string; time: string } | null {
  if (!o.deliveryDate || !o.slotStart) return null;
  return { day: dayLabel(o.deliveryDate), time: `${o.slotStart}–${o.slotEnd}` };
}

/** Sort key for "which one is due soonest": date + slot start; no slot sorts last. */
const dueKey = (o: BoardOrder) => (o.deliveryDate && o.slotStart ? `${o.deliveryDate} ${o.slotStart}` : "9999");

const dishCount = (o: BoardOrder) => o.lines.reduce((n, l) => n + l.quantity, 0);

const waitedSeconds = (o: BoardOrder, now: number) =>
  Math.max(0, Math.floor((now - Date.parse(o.paidAt ?? o.placedAt)) / 1000));

function readPrinted(): Record<string, number> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PRINTED_KEY) ?? "{}") as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

function writePrinted(map: Record<string, number>) {
  try {
    // Forget old entries so the record doesn't grow for ever.
    const cutoff = Date.now() - 7 * 86_400_000;
    for (const id of Object.keys(map)) if (map[id] < cutoff) delete map[id];
    window.localStorage.setItem(PRINTED_KEY, JSON.stringify(map));
  } catch {
    // No storage: worst case a ticket prints twice after a reload.
  }
}

/* ------------------------------------------------------------------- tabs */

type TabId = "new" | "cooking" | "ready" | "rider" | "done" | "scheduled";

const TABS: { id: TabId; label: string; hint: string }[] = [
  { id: "new", label: "New", hint: "Paid and waiting for the kitchen to accept" },
  { id: "cooking", label: "Cooking", hint: "Accepted and being prepared" },
  { id: "ready", label: "Ready", hint: "Cooked and waiting for a rider" },
  { id: "rider", label: "With rider", hint: "Picked up and on the way" },
  { id: "done", label: "Done", hint: "Delivered in the last 12 hours" },
  { id: "scheduled", label: "Scheduled", hint: "Accepted for later, and today's not-yet-started" },
];

/**
 * Which tab an order belongs to. Every order is in exactly one, so the counts
 * across the bar add up to the whole board.
 */
function tabOf(order: BoardOrder): TabId {
  switch (order.status) {
    case "new":
      return "new";
    case "preparing":
      return "cooking";
    case "ready":
      return "ready";
    case "on_the_way":
      return "rider";
    case "delivered":
      return "done";
    case "scheduled":
      return "scheduled";
  }
}

/**
 * The live orders board for the kitchen: a paid order appears the moment it
 * arrives and the screen beeps — repeatedly, for every order still waiting —
 * until someone accepts it.
 *
 * It is laid out as **tabs over a list, with the chosen order shown in full beside
 * it** (Danish's ask, Nov 2026): one tab per stage of an order's life — new,
 * cooking, ready, with the rider, done, and scheduled for later — so "what is out
 * with a rider" or "what went out already" is one tap rather than a scroll past
 * everything else. The left column is the queue for the chosen tab; the right is
 * everything about the order being looked at: what to cook, who it is for and where
 * it goes, the customer's note (marked as an allergy check), the rider, and the
 * button for its next step. Below `lg` the list fills the screen and tapping a row
 * opens the order, with a way back.
 *
 * The board can also print a ticket by itself whenever an order is accepted — by
 * anyone, from any screen — see `useAutoPrint`.
 */
export default function KitchenBoard({ endpoint = "/api/kitchen/orders" }: { endpoint?: string }) {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
  const [riders, setRiders] = useState<BoardRider[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [offline, setOffline] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  /** Below `lg` the list and the order share the screen; this says which one is showing. */
  const [showDetail, setShowDetail] = useState(false);
  const failures = useRef(0);

  const poll = useCallback(async () => {
    try {
      const res = await fetch(endpoint, { cache: "no-store" });
      if (res.status === 401) {
        window.location.assign("/login");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { orders: BoardOrder[]; riders?: BoardRider[] };
      setOrders(data.orders);
      setRiders(data.riders ?? []);
      setLoaded(true);
      failures.current = 0;
      setOffline(false);
    } catch {
      // Keep showing the last good list; only say so after it keeps failing.
      failures.current += 1;
      if (failures.current >= 2) setOffline(true);
    }
  }, [endpoint]);

  useEffect(() => {
    // First fetch from a timer callback (not the effect body), then every few seconds.
    const first = setTimeout(poll, 0);
    const id = setInterval(poll, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(id);
    };
  }, [poll]);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Which scheduled orders have had their day come round. Re-read each minute, not
  // each second — the date only turns over at midnight.
  const minute = Math.floor(now / 60_000);
  const dueTodayIds = useMemo(() => {
    const at = new Date(minute * 60_000);
    return new Set(
      orders.filter((o) => o.status === "scheduled" && !isFutureDelivery(o.deliveryDate, at)).map((o) => o.id)
    );
  }, [orders, minute]);

  /** Every tab's list, sorted the way that stage wants to be read. */
  const groups = useMemo(() => {
    const out: Record<TabId, BoardOrder[]> = { new: [], cooking: [], ready: [], rider: [], done: [], scheduled: [] };
    for (const order of orders) out[tabOf(order)].push(order);
    // Longest wait first: the order that has been sitting there is the urgent one.
    out.new.sort((a, b) => Date.parse(a.paidAt ?? a.placedAt) - Date.parse(b.paidAt ?? b.placedAt));
    for (const id of ["cooking", "ready", "rider"] as const) {
      out[id].sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
    }
    // Due today before the days still to come, then soonest first.
    out.scheduled.sort(
      (a, b) => Number(dueTodayIds.has(b.id)) - Number(dueTodayIds.has(a.id)) || dueKey(a).localeCompare(dueKey(b))
    );
    // Finished: the one that just went out on top.
    out.done.sort((a, b) => Date.parse(b.deliveredAt ?? b.placedAt) - Date.parse(a.deliveredAt ?? a.placedAt));
    return out;
  }, [orders, dueTodayIds]);

  const waiting = groups.new;
  const list = groups[tab];
  // Derived, never stored: the chosen order if it is still in this tab, else the first
  // one. So accepting an order simply moves the selection on, with no effect to go wrong.
  const current = list.find((o) => o.id === selectedId) ?? list[0] ?? null;

  // Beep for as long as anything is waiting to be accepted — one shared beep,
  // not one per order.
  useEffect(() => {
    if (!soundOn || waiting.length === 0) return;
    beep();
    const id = setInterval(beep, BEEP_MS);
    return () => clearInterval(id);
  }, [soundOn, waiting.length]);

  const printer = useAutoPrint(orders, loaded);

  async function advance(order: BoardOrder, to: "preparing" | "ready") {
    setBusyId(order.id);
    setError(null);
    const result = await advanceKitchenOrderAction(order.id, to);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message ?? "That didn't work — try again.");
      return;
    }
    // Reflect it at once; the next poll confirms. Accepting an order for a later
    // day makes it "scheduled", not "preparing" — the server decides, we mirror it.
    const next = order.status === "new" && to === "preparing" ? acceptTarget(order.deliveryDate) : to;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, status: next, acceptedAt: o.acceptedAt ?? new Date().toISOString() } : o
      )
    );
    poll();
  }

  async function assign(order: BoardOrder, riderId: string) {
    setError(null);
    const rider = riders.find((r) => r.id === riderId) ?? null;
    const before = { id: order.assignedRiderId, name: order.assignedRiderName };
    setOrders((prev) =>
      prev.map((o) =>
        o.id === order.id ? { ...o, assignedRiderId: rider?.id ?? null, assignedRiderName: rider?.name ?? null } : o
      )
    );
    const result = await assignKitchenRiderAction(order.id, riderId || null);
    if (!result.ok) {
      setError(result.message ?? "Couldn't assign the rider — try again.");
      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, assignedRiderId: before.id, assignedRiderName: before.name } : o))
      );
    }
  }

  const urgent = waiting.some((o) => waitedSeconds(o, now) >= URGENT_AFTER);
  const dueTodayWaiting = groups.scheduled.some((o) => dueTodayIds.has(o.id));

  function openOrder(id: string) {
    setSelectedId(id);
    setShowDetail(true);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6">
      {!soundOn && (
        <button
          type="button"
          onClick={() => {
            setSoundOn(true);
            beep();
          }}
          className="mb-4 flex w-full items-center justify-center gap-3 rounded-2xl bg-ember-600 px-5 py-4 text-base font-semibold text-white shadow-lg hover:bg-ember-500"
        >
          <Volume2 size={22} />
          Tap here to turn on the new-order sound
        </button>
      )}

      {offline && (
        <p
          role="alert"
          className="mb-4 flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger"
        >
          <WifiOff size={18} />
          Lost connection — this list may be out of date. Retrying…
        </p>
      )}
      {error && (
        <p role="alert" className="mb-4 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {/* ---- one tab per stage, with how many are in it ---- */}
      <div
        role="tablist"
        aria-label="Order stage"
        className="mb-4 flex gap-1.5 overflow-x-auto rounded-2xl border border-hairline bg-panel p-1.5"
      >
        {TABS.map((t) => {
          const count = groups[t.id].length;
          const active = t.id === tab;
          const loud = (t.id === "new" && count > 0) || (t.id === "scheduled" && dueTodayWaiting);
          return (
            <button
              key={t.id}
              role="tab"
              type="button"
              aria-selected={active}
              title={t.hint}
              onClick={() => {
                setTab(t.id);
                setShowDetail(false);
              }}
              className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                active ? "bg-charcoal-600 text-white" : "text-body-text hover:bg-canvas"
              }`}
            >
              {t.label}
              <span
                className={`inline-flex min-w-6 justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                  active
                    ? "bg-white/20 text-white"
                    : loud
                      ? urgent && t.id === "new"
                        ? "bg-danger text-white"
                        : "bg-ember-600 text-white"
                      : "bg-hairline text-muted"
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {!loaded ? (
        <p className="py-24 text-center text-muted">Loading orders…</p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
          {/* ---- the queue for this tab ---- */}
          <div className={`min-w-0 ${showDetail ? "hidden lg:block" : ""}`}>
            {list.length === 0 ? (
              <EmptyList tab={tab} />
            ) : (
              <ul className="space-y-2">
                {list.map((o) => (
                  <li key={o.id}>
                    <ListRow
                      order={o}
                      active={current?.id === o.id}
                      now={now}
                      dueToday={dueTodayIds.has(o.id)}
                      onOpen={() => openOrder(o.id)}
                    />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* ---- everything about the one being looked at ---- */}
          <div className={`min-w-0 ${showDetail ? "" : "hidden lg:block"}`}>
            {current ? (
              <Detail
                order={current}
                now={now}
                dueToday={dueTodayIds.has(current.id)}
                busy={busyId === current.id}
                riders={riders}
                onAssign={assign}
                onAdvance={advance}
                onBack={() => setShowDetail(false)}
              />
            ) : (
              <div className="flex h-full min-h-60 flex-col items-center justify-center gap-3 rounded-2xl border border-hairline bg-panel py-16 text-center">
                <ChefHat size={40} className="text-faint" />
                <p className="font-display text-lg font-semibold text-heading">Nothing to show here</p>
                <p className="max-w-xs text-sm text-muted">{TABS.find((t) => t.id === tab)?.hint}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- the one setting this screen owns ---- */}
      <div className="mt-5 rounded-2xl border border-hairline bg-panel px-4 py-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            checked={printer.on}
            onChange={(e) => printer.set(e.target.checked)}
            className="h-5 w-5 accent-ember-600"
          />
          <span className="flex min-w-0 flex-wrap items-center gap-2 text-sm font-semibold text-heading">
            <Printer size={16} className="shrink-0" />
            Print a ticket automatically when an order is accepted
            {printer.on && (
              <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">On for this device</span>
            )}
          </span>
        </label>
        <details className="mt-1.5 pl-8">
          <summary className="cursor-pointer text-xs font-semibold text-muted">How this works</summary>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Tick this on the one computer or tablet the thermal printer is attached to. Tickets go to that
            device&apos;s default printer; for printing without a pop-up, open Chrome with{" "}
            <code className="rounded bg-canvas px-1">--kiosk-printing</code>. Don&apos;t tick it on two screens, or
            every ticket prints twice.
          </p>
        </details>
      </div>
    </div>
  );
}

function EmptyList({ tab }: { tab: TabId }) {
  const text: Record<TabId, string> = {
    new: "No new orders. One arriving here makes a sound.",
    cooking: "Nothing is being cooked right now.",
    ready: "Nothing is waiting for a rider.",
    rider: "No order is out with a rider.",
    done: "Nothing has been delivered in the last 12 hours.",
    scheduled: "Nothing is booked for later.",
  };
  return (
    <p className="rounded-2xl border border-dashed border-hairline bg-panel px-4 py-10 text-center text-sm text-muted">
      {text[tab]}
    </p>
  );
}

/* -------------------------------------------------------------- the queue */

/** The colour down the left edge of a row and of the open order: the stage, at a glance. */
function railFor(order: BoardOrder, now: number, dueToday: boolean): string {
  if (order.status === "new") {
    const s = waitedSeconds(order, now);
    return s >= URGENT_AFTER ? "bg-danger" : s >= WARN_AFTER ? "bg-warn" : "bg-ember-600";
  }
  if (order.status === "ready" || order.status === "delivered") return "bg-success";
  if (order.status === "on_the_way") return "bg-violet-400";
  if (order.status === "scheduled") return dueToday ? "bg-ember-600" : "bg-faint";
  return "bg-hairline";
}

/** The one time a row shows: how long it has waited, when it is due, or when it went out. */
function rowClock(order: BoardOrder, now: number): { text: string; tone: string; urgent: boolean } {
  if (order.status === "new") {
    const s = waitedSeconds(order, now);
    return {
      text: mmss(s),
      tone:
        s >= URGENT_AFTER
          ? "bg-danger text-white"
          : s >= WARN_AFTER
            ? "bg-warn-soft text-warn"
            : "bg-canvas text-muted",
      urgent: s >= URGENT_AFTER,
    };
  }
  if (order.status === "delivered" && order.deliveredAt) {
    return { text: clockAt(order.deliveredAt), tone: "bg-success-soft text-success", urgent: false };
  }
  const slot = slotParts(order);
  return { text: slot ? slot.time : "—", tone: "bg-canvas text-muted", urgent: false };
}

function ListRow({
  order,
  active,
  now,
  dueToday,
  onOpen,
}: {
  order: BoardOrder;
  active: boolean;
  now: number;
  dueToday: boolean;
  onOpen: () => void;
}) {
  const clock = rowClock(order, now);
  const unpaid = order.paymentStatus !== "paid";
  const later = order.status === "scheduled" && !dueToday;
  const dishes = dishCount(order);

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-current={active ? "true" : undefined}
      className={`relative flex w-full items-center gap-3 overflow-hidden rounded-xl border bg-panel py-3 pl-5 pr-3 text-left transition-colors ${
        active ? "border-charcoal-600 ring-1 ring-charcoal-600" : "border-hairline hover:bg-canvas"
      }`}
    >
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${railFor(order, now, dueToday)}`} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate font-display text-base font-semibold text-heading">{order.reference}</span>
          {unpaid && <Wallet size={13} className="shrink-0 text-warn" aria-label="Not paid yet" />}
        </div>
        <p className="truncate text-sm text-body-text">{order.customerName}</p>
        <p className="mt-0.5 truncate text-xs text-muted">
          {dishes} {dishes === 1 ? "dish" : "dishes"}
          {order.town ? ` · ${order.town}` : ""}
          {order.assignedRiderName ? ` · ${order.assignedRiderName}` : ""}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        <span className="flex flex-col items-end gap-1">
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${clock.tone}`}
          >
            {clock.urgent ? <AlertTriangle size={11} /> : <Clock size={11} />}
            {clock.text}
          </span>
          {later && order.deliveryDate && (
            <span className="rounded-full bg-violet-50 px-2 py-0.5 text-[0.65rem] font-semibold text-violet-700">
              {dayLabel(order.deliveryDate)}
            </span>
          )}
        </span>
        <ChevronRight size={16} className="text-faint lg:hidden" />
      </div>
    </button>
  );
}

/* -------------------------------------------------------------- the order */

/** The next step for this order, if the kitchen has one. */
function stepFor(
  order: BoardOrder,
  dueToday: boolean
): { label: string; to: "preparing" | "ready"; primary: boolean } | null {
  if (order.status === "new") return { label: "Accept order", to: "preparing", primary: true };
  if (order.status === "scheduled")
    return { label: dueToday ? "Start preparing" : "Start now anyway", to: "preparing", primary: dueToday };
  if (order.status === "preparing") return { label: "Mark as ready", to: "ready", primary: true };
  return null;
}

const STAGE_LABEL: Record<BoardOrder["status"], string> = {
  new: "Waiting to be accepted",
  scheduled: "Scheduled",
  preparing: "Cooking",
  ready: "Ready for the rider",
  on_the_way: "On the way",
  delivered: "Delivered",
};

function Detail({
  order,
  now,
  dueToday,
  busy,
  riders,
  onAssign,
  onAdvance,
  onBack,
}: {
  order: BoardOrder;
  now: number;
  dueToday: boolean;
  busy: boolean;
  riders: BoardRider[];
  onAssign: (order: BoardOrder, riderId: string) => void;
  onAdvance: (order: BoardOrder, to: "preparing" | "ready") => void;
  onBack: () => void;
}) {
  const slot = slotParts(order);
  const step = stepFor(order, dueToday);
  const unpaid = order.paymentStatus !== "paid";
  const telHref = `tel:${order.phone.replace(/[^\d+]/g, "")}`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;
  const label = "text-[0.65rem] font-bold uppercase tracking-[0.12em] text-faint";
  const gone = order.status === "on_the_way" || order.status === "delivered";
  const waited = order.status === "new" ? waitedSeconds(order, now) : null;
  const since =
    order.status === "preparing" && order.acceptedAt
      ? Math.max(0, Math.floor((now - Date.parse(order.acceptedAt)) / 1000))
      : null;

  return (
    <article className="relative overflow-hidden rounded-2xl border border-hairline bg-panel shadow-sm">
      <span aria-hidden="true" className={`absolute inset-y-0 left-0 w-1.5 ${railFor(order, now, dueToday)}`} />

      <div className="flex flex-col gap-5 py-5 pl-6 pr-4 sm:pl-7 sm:pr-5">
        {/* ---- who it is for ---- */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="mb-2 -ml-1 inline-flex items-center gap-1 rounded-lg px-1 py-1 text-sm font-semibold text-muted hover:text-heading lg:hidden"
            >
              <ChevronLeft size={16} />
              All orders
            </button>
            <p className="font-display text-2xl font-semibold leading-tight tracking-tight text-heading">
              {order.reference}
            </p>
            <p className="mt-1 text-base font-medium text-body-text">{order.customerName}</p>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted">
              {STAGE_LABEL[order.status]}
              {order.status === "scheduled" && order.deliveryDate
                ? ` · ${dueToday ? "due today" : `for ${dayLabel(order.deliveryDate, true)}`}`
                : ""}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {waited !== null && (
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${
                  waited >= URGENT_AFTER
                    ? "bg-danger text-white"
                    : waited >= WARN_AFTER
                      ? "bg-warn-soft text-warn"
                      : "bg-canvas text-muted"
                }`}
              >
                {waited >= URGENT_AFTER ? <AlertTriangle size={14} /> : <Clock size={14} />}
                Waiting {mmss(waited)}
              </span>
            )}
            {since !== null && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-canvas px-3 py-1.5 text-sm font-semibold tabular-nums text-muted">
                <Clock size={14} />
                Accepted {mmss(since)} ago
              </span>
            )}
            {order.status === "delivered" && order.deliveredAt && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-sm font-semibold text-success">
                <Check size={14} />
                Delivered {clockAt(order.deliveredAt)}
              </span>
            )}
          </div>
        </div>

        {/* ---- the next step, and the ticket ---- */}
        <div className="flex flex-wrap items-center gap-2">
          {step ? (
            <button
              type="button"
              onClick={() => onAdvance(order, step.to)}
              disabled={busy}
              className={`inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition-colors disabled:opacity-60 sm:min-w-56 sm:flex-none ${
                step.primary
                  ? "bg-ember-600 text-white shadow-sm hover:bg-ember-500"
                  : "border border-hairline text-body-text hover:bg-canvas"
              }`}
            >
              {step.primary && <Check size={18} />}
              {busy ? "…" : step.label}
            </button>
          ) : (
            <span className="inline-flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-canvas px-5 py-3 text-sm font-semibold text-muted sm:min-w-56 sm:flex-none">
              <Check size={16} />
              {order.status === "ready"
                ? "Waiting for the rider"
                : order.status === "on_the_way"
                  ? "Out with the rider"
                  : "Finished"}
            </span>
          )}
          <a
            href={`/admin/orders/${order.id}/ticket`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-hairline px-4 py-3 text-sm font-semibold text-muted transition-colors hover:bg-canvas hover:text-heading"
          >
            <Printer size={16} />
            Ticket
          </a>
        </div>

        {order.status === "scheduled" && !dueToday && order.deliveryDate && (
          <p className="flex items-start gap-2 rounded-xl bg-violet-50 px-3 py-2.5 text-sm font-semibold leading-snug text-violet-700">
            <CalendarClock size={16} className="mt-px shrink-0" />
            For {dayLabel(order.deliveryDate, true)} — don&apos;t start yet.
          </p>
        )}

        <div className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,17rem)]">
          {/* ---- what to cook ---- */}
          <div className="min-w-0">
            <p className={`${label} mb-2`}>What to cook</p>
            <ul className="space-y-2">
              {order.lines.map((l, i) => (
                <li key={i} className="flex items-baseline gap-3 text-lg leading-snug">
                  <span className="inline-flex min-w-8 shrink-0 justify-center rounded-md bg-ember-600/10 px-1.5 py-0.5 font-display text-base font-bold tabular-nums text-ember-700">
                    {l.quantity}
                  </span>
                  <div className="min-w-0">
                    <span className="font-medium text-heading">{l.name}</span>
                    {(l.details?.length ?? 0) > 0 && (
                      <ul className="mt-0.5 space-y-0.5 text-sm text-body-text">
                        {l.details!.map((d, j) => (
                          <li key={j} className="flex gap-1.5">
                            <span aria-hidden="true" className="text-faint">
                              –
                            </span>
                            <span>{d}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {l.instructions && <p className="mt-0.5 text-sm italic text-muted">“{l.instructions}”</p>}
                  </div>
                </li>
              ))}
            </ul>

            {order.note && (
              <div className="mt-4 rounded-lg border-l-4 border-warn bg-warn-soft px-3 py-2.5">
                <p className="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-warn">
                  <StickyNote size={13} />
                  Note — check for allergies
                </p>
                <p className="mt-1 text-base font-semibold leading-snug text-heading">{order.note}</p>
              </div>
            )}

            {unpaid && (
              <p className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-canvas px-2.5 py-1.5 text-xs font-semibold text-muted">
                <Wallet size={13} />
                {order.paymentMethod === "cash"
                  ? "Collect cash"
                  : order.paymentMethod === "bank_transfer"
                    ? "Bank transfer – not in yet"
                    : order.paymentMethod === "payment_link"
                      ? "Payment link – not confirmed"
                      : "Pay later"}
              </p>
            )}
          </div>

          {/* ---- when, where, and who takes it ---- */}
          <div className="flex flex-col gap-3 text-sm">
            {slot && (
              <div className="rounded-lg bg-canvas px-3 py-2.5">
                <p className={label}>Deliver</p>
                <p className="mt-0.5 text-sm font-semibold text-heading first-letter:uppercase">{slot.day}</p>
                <p className="font-display text-lg font-semibold tabular-nums text-heading">{slot.time}</p>
              </div>
            )}

            <div>
              <p className={`${label} mb-1.5`}>Where it goes</p>
              <a
                href={telHref}
                className="flex items-center gap-2.5 font-semibold tabular-nums text-heading transition-colors hover:text-ember-700"
              >
                <Phone size={15} className="shrink-0 text-faint" />
                {order.phone}
              </a>
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-start gap-2.5 leading-snug text-body-text transition-colors hover:text-ember-700"
              >
                <MapPin size={15} className="mt-0.5 shrink-0 text-faint" />
                {order.address}
              </a>
            </div>

            {/* Once it has left the kitchen the rider is a fact, not a choice. */}
            {gone ? (
              <p className="flex items-center gap-2.5 font-semibold text-heading">
                <Bike size={15} className="shrink-0 text-faint" />
                {order.assignedRiderName ?? "No rider was assigned"}
              </p>
            ) : (
              riders.length > 0 && (
              <label className="flex items-center gap-2.5">
                <Bike size={15} className="shrink-0 text-faint" />
                <span className="sr-only">Rider for {order.reference}</span>
                <select
                  value={order.assignedRiderId ?? ""}
                  onChange={(e) => onAssign(order, e.target.value)}
                  className="h-10 min-w-0 flex-1 rounded-lg border border-hairline bg-panel px-2 text-sm font-semibold text-heading transition-colors hover:border-faint focus:border-ember-500 focus:outline-none"
                >
                  <option value="">No rider yet</option>
                  {riders.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </label>
              )
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------- auto-print */

/**
 * Prints the kitchen ticket by itself when an order has been accepted — whoever
 * accepted it, from whichever screen. Opt-in per device (the printer is attached to
 * one computer), remembered in that browser.
 *
 * How it works: the ticket page (`/admin/orders/[id]/ticket?auto=1`) is loaded in a
 * hidden frame and prints itself. A website can't talk to a printer on the Wi-Fi
 * directly, so this relies on the printer being installed on the device the board
 * is open on; with Chrome's `--kiosk-printing` switch it prints without a dialog.
 * Each order is printed once per device (`PRINTED_KEY`), only if it was accepted in
 * the last half hour, and tickets go out `PRINT_GAP_MS` apart. Switching it on never
 * reprints what is already on the board.
 */
function useAutoPrint(orders: BoardOrder[], loaded: boolean) {
  const [on, setOn] = useState(false);
  const queue = useRef<string[]>([]);
  const busy = useRef(false);
  // The queue calls itself again after each ticket's gap; through a ref so the
  // callback below doesn't refer to itself.
  const again = useRef<() => void>(() => {});

  // Read the saved choice after mount (not during render: the server has no localStorage).
  useEffect(() => {
    const t = window.setTimeout(() => {
      try {
        setOn(window.localStorage.getItem(AUTOPRINT_KEY) === "1");
      } catch {
        // No storage: it stays off.
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const set = useCallback(
    (value: boolean) => {
      setOn(value);
      try {
        window.localStorage.setItem(AUTOPRINT_KEY, value ? "1" : "0");
      } catch {
        // Fine — it just won't be remembered.
      }
      if (value) {
        // Everything on the board right now counts as already printed.
        const printed = readPrinted();
        for (const o of orders) printed[o.id] ??= Date.now();
        writePrinted(printed);
      }
    },
    [orders]
  );

  const drain = useCallback(() => {
    if (busy.current) return;
    const id = queue.current.shift();
    if (!id) return;
    busy.current = true;

    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
    frame.src = `/admin/orders/${encodeURIComponent(id)}/ticket?auto=1`;
    document.body.appendChild(frame);

    window.setTimeout(() => frame.remove(), 60_000);
    window.setTimeout(() => {
      busy.current = false;
      again.current();
    }, PRINT_GAP_MS);
  }, []);

  useEffect(() => {
    again.current = drain;
  }, [drain]);

  useEffect(() => {
    if (!on || !loaded) return;
    const printed = readPrinted();
    let changed = false;
    for (const o of orders) {
      // Only an order the kitchen still holds: one already out with a rider or
      // delivered was accepted long before this device ever saw it.
      if (o.status !== "scheduled" && o.status !== "preparing" && o.status !== "ready") continue;
      if (!o.acceptedAt || printed[o.id]) continue;
      if (Date.now() - Date.parse(o.acceptedAt) > PRINT_WINDOW_MS) continue;
      printed[o.id] = Date.now();
      queue.current.push(o.id);
      changed = true;
    }
    if (changed) {
      writePrinted(printed);
      drain();
    }
  }, [orders, on, loaded, drain]);

  return { on, set };
}

/** Header button: put the board on the whole screen, for a wall-mounted tablet. */
export function FullscreenButton() {
  return (
    <button
      type="button"
      onClick={() => {
        if (document.fullscreenElement) document.exitFullscreen();
        else document.documentElement.requestFullscreen?.();
      }}
      className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold text-muted transition-colors hover:bg-canvas hover:text-heading"
    >
      <Maximize2 size={15} />
      Full screen
    </button>
  );
}
