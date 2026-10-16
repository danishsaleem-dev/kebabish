"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bike,
  CalendarClock,
  Check,
  ChefHat,
  Clock,
  MapPin,
  Maximize2,
  Phone,
  Printer,
  StickyNote,
  Volume2,
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
  status: "new" | "scheduled" | "preparing" | "ready";
  paymentStatus: string;
  paymentMethod: string;
  paidAt: string | null;
  acceptedAt: string | null;
  placedAt: string;
  deliveryDate: string | null;
  slotStart: string | null;
  slotEnd: string | null;
  lines: { quantity: number; name: string }[];
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

function slotLabel(o: BoardOrder): string | null {
  if (!o.deliveryDate || !o.slotStart) return null;
  return `${dayLabel(o.deliveryDate)} · ${o.slotStart}–${o.slotEnd}`;
}

/** Sort key for "which one is due soonest": date + slot start; no slot sorts last. */
const dueKey = (o: BoardOrder) => (o.deliveryDate && o.slotStart ? `${o.deliveryDate} ${o.slotStart}` : "9999");

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

/**
 * The live orders board for the kitchen: a paid order appears the moment it
 * arrives and the screen beeps — repeatedly, for every order still waiting —
 * until someone accepts it. A card shows what to cook, who it is for and where it
 * goes, the customer's note (marked as an allergy check), the rider, and one big
 * button for the next step.
 *
 * Order of the board: orders waiting to be accepted first (longest wait on
 * top); scheduled orders whose day has come, ready to start; what's being prepared
 * (soonest delivery slot first); what's ready for the rider; and, last, what has
 * been accepted for a later day and isn't to be started yet.
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

  const waiting = useMemo(
    () =>
      orders
        .filter((o) => o.status === "new")
        .sort((a, b) => Date.parse(a.paidAt ?? a.placedAt) - Date.parse(b.paidAt ?? b.placedAt)),
    [orders]
  );
  // Scheduled orders split on whether their day has come. Re-evaluated each minute
  // (not every second) — the date only changes at midnight.
  const minute = Math.floor(now / 60_000);
  const { dueToday, later } = useMemo(() => {
    const at = new Date(minute * 60_000);
    const scheduled = orders.filter((o) => o.status === "scheduled").sort((a, b) => dueKey(a).localeCompare(dueKey(b)));
    return {
      dueToday: scheduled.filter((o) => !isFutureDelivery(o.deliveryDate, at)),
      later: scheduled.filter((o) => isFutureDelivery(o.deliveryDate, at)),
    };
  }, [orders, minute]);
  const preparing = useMemo(
    () => orders.filter((o) => o.status === "preparing").sort((a, b) => dueKey(a).localeCompare(dueKey(b))),
    [orders]
  );
  const ready = useMemo(
    () => orders.filter((o) => o.status === "ready").sort((a, b) => dueKey(a).localeCompare(dueKey(b))),
    [orders]
  );

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
        o.id === order.id
          ? { ...o, status: next, acceptedAt: o.acceptedAt ?? new Date().toISOString() }
          : o
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

  const urgent = waiting.some((o) => (now - Date.parse(o.paidAt ?? o.placedAt)) / 1000 >= URGENT_AFTER);

  const cardProps = { riders, onAssign: assign };

  return (
    <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6">
      {!soundOn && (
        <button
          type="button"
          onClick={() => {
            setSoundOn(true);
            beep();
          }}
          className="mb-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-ember-600 px-5 py-4 text-base font-semibold text-white shadow-lg hover:bg-ember-500"
        >
          <Volume2 size={22} />
          Tap here to turn on the new-order sound
        </button>
      )}

      <label className="mb-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-hairline bg-panel px-4 py-3">
        <input
          type="checkbox"
          checked={printer.on}
          onChange={(e) => printer.set(e.target.checked)}
          className="mt-1 h-5 w-5 accent-ember-600"
        />
        <span className="min-w-0 text-sm">
          <span className="flex items-center gap-2 font-semibold text-heading">
            <Printer size={16} />
            Print a ticket automatically when an order is accepted
            {printer.on && <span className="rounded-full bg-success-soft px-2 py-0.5 text-xs text-success">On for this device</span>}
          </span>
          <span className="mt-0.5 block text-xs text-muted">
            Tick this on the one computer or tablet the thermal printer is attached to. Tickets go to that
            device&apos;s default printer; for printing without a pop-up, open Chrome with{" "}
            <code className="rounded bg-canvas px-1">--kiosk-printing</code>. Don&apos;t tick it on two screens, or
            every ticket prints twice.
          </span>
        </span>
      </label>

      {offline && (
        <p role="alert" className="mb-5 flex items-center gap-2 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          <WifiOff size={18} />
          Lost connection — this list may be out of date. Retrying…
        </p>
      )}
      {error && (
        <p role="alert" className="mb-5 rounded-2xl bg-danger-soft px-4 py-3 text-sm font-semibold text-danger">
          {error}
        </p>
      )}

      {!loaded ? (
        <p className="py-24 text-center text-muted">Loading orders…</p>
      ) : orders.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-24 text-center">
          <ChefHat size={44} className="text-faint" />
          <p className="font-display text-xl font-semibold text-heading">No orders right now</p>
          <p className="text-sm text-muted">New paid orders appear here by themselves, with a sound.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {waiting.length > 0 && (
            <Section title="Waiting to be accepted" count={waiting.length} tone={urgent ? "danger" : "ember"}>
              {waiting.map((o) => {
                const seconds = Math.max(0, Math.floor((now - Date.parse(o.paidAt ?? o.placedAt)) / 1000));
                const later = acceptTarget(o.deliveryDate) === "scheduled";
                return (
                  <Card
                    key={o.id}
                    order={o}
                    tone={seconds >= URGENT_AFTER ? "danger" : seconds >= WARN_AFTER ? "warn" : "new"}
                    clock={`Waiting ${mmss(seconds)}`}
                    action={{
                      label: later && o.deliveryDate ? `Accept — for ${dayLabel(o.deliveryDate)}` : "Accept order",
                      onClick: () => advance(o, "preparing"),
                      busy: busyId === o.id,
                    }}
                    hint={later ? "For a later day: accepting it schedules it, it won't show as being cooked." : undefined}
                    {...cardProps}
                  />
                );
              })}
            </Section>
          )}

          {dueToday.length > 0 && (
            <Section title="Scheduled — due today, ready to start" count={dueToday.length} tone="ember" icon="calendar">
              {dueToday.map((o) => (
                <Card
                  key={o.id}
                  order={o}
                  tone="prep"
                  action={{ label: "Start preparing", onClick: () => advance(o, "preparing"), busy: busyId === o.id }}
                  {...cardProps}
                />
              ))}
            </Section>
          )}

          {preparing.length > 0 && (
            <Section title="Preparing" count={preparing.length} tone="warn">
              {preparing.map((o) => {
                const since = o.acceptedAt ? Math.max(0, Math.floor((now - Date.parse(o.acceptedAt)) / 1000)) : null;
                return (
                  <Card
                    key={o.id}
                    order={o}
                    tone="prep"
                    clock={since != null ? `Accepted ${mmss(since)} ago` : undefined}
                    action={{ label: "Mark ready for the rider", onClick: () => advance(o, "ready"), busy: busyId === o.id }}
                    {...cardProps}
                  />
                );
              })}
            </Section>
          )}

          {ready.length > 0 && (
            <Section title="Ready — waiting for the rider" count={ready.length} tone="ok">
              {ready.map((o) => (
                <Card key={o.id} order={o} tone="ready" {...cardProps} />
              ))}
            </Section>
          )}

          {later.length > 0 && (
            <Section title="Coming up — accepted for a later day" count={later.length} tone="muted" icon="calendar">
              {later.map((o) => (
                <Card
                  key={o.id}
                  order={o}
                  tone="later"
                  banner={o.deliveryDate ? `For ${dayLabel(o.deliveryDate, true)} — don't start yet` : undefined}
                  secondaryAction={{
                    label: "Start now anyway",
                    onClick: () => advance(o, "preparing"),
                    busy: busyId === o.id,
                  }}
                  {...cardProps}
                />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

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
      if (o.status === "new" || !o.acceptedAt || printed[o.id]) continue;
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

function Section({
  title,
  count,
  tone,
  icon,
  children,
}: {
  title: string;
  count: number;
  tone: "ember" | "danger" | "warn" | "ok" | "muted";
  icon?: "calendar";
  children: React.ReactNode;
}) {
  const dot = { ember: "bg-ember-600", danger: "bg-danger", warn: "bg-warn", ok: "bg-success", muted: "bg-faint" }[tone];
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-semibold text-heading">
        {icon === "calendar" ? <CalendarClock size={18} className="text-muted" /> : <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />}
        {title}
        <span className="rounded-full bg-hairline px-2.5 py-0.5 text-sm font-semibold text-body-text">{count}</span>
      </h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{children}</div>
    </section>
  );
}

function Card({
  order,
  tone,
  clock,
  action,
  secondaryAction,
  banner,
  hint,
  riders,
  onAssign,
}: {
  order: BoardOrder;
  tone: "new" | "warn" | "danger" | "prep" | "ready" | "later";
  clock?: string;
  action?: { label: string; onClick: () => void; busy: boolean };
  secondaryAction?: { label: string; onClick: () => void; busy: boolean };
  banner?: string;
  hint?: string;
  riders: BoardRider[];
  onAssign: (order: BoardOrder, riderId: string) => void;
}) {
  const border = {
    new: "border-ember-600",
    warn: "border-warn",
    danger: "border-danger",
    prep: "border-hairline",
    ready: "border-success",
    later: "border-hairline border-dashed",
  }[tone];
  const clockTone = {
    new: "bg-canvas text-muted",
    warn: "bg-warn-soft text-warn",
    danger: "bg-danger text-white",
    prep: "bg-canvas text-muted",
    ready: "",
    later: "bg-canvas text-muted",
  }[tone];
  const slot = slotLabel(order);
  const unpaid = order.paymentStatus !== "paid";
  const telHref = `tel:${order.phone.replace(/[^\d+]/g, "")}`;
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.address)}`;

  return (
    <article className={`flex flex-col rounded-2xl border-2 bg-panel p-4 shadow-sm ${border}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold leading-none text-heading">{order.reference}</p>
          <p className="mt-1 truncate text-sm font-semibold text-body-text">{order.customerName}</p>
        </div>
        {clock && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${clockTone}`}>
            {tone === "danger" ? <AlertTriangle size={14} /> : <Clock size={14} />}
            {clock}
          </span>
        )}
      </header>

      {banner && (
        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-violet-50 px-2.5 py-1.5 text-sm font-semibold text-violet-700">
          <CalendarClock size={14} />
          {banner}
        </p>
      )}

      {slot && (
        <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-lg bg-canvas px-2.5 py-1.5 text-sm font-semibold text-heading">
          <Clock size={14} className="text-muted" />
          Deliver {slot}
        </p>
      )}

      <ul className="mt-4 space-y-2">
        {order.lines.map((l, i) => (
          <li key={i} className="flex gap-3 text-lg leading-snug">
            <span className="w-9 shrink-0 text-right font-display font-semibold text-ember-700">{l.quantity}×</span>
            <span className="text-heading">{l.name}</span>
          </li>
        ))}
      </ul>

      {order.note && (
        <div className="mt-4 rounded-xl border-2 border-warn bg-warn-soft p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-warn">
            <StickyNote size={14} />
            Customer note — check for allergies
          </p>
          <p className="text-base font-semibold text-heading">{order.note}</p>
        </div>
      )}

      {/* Who it's for and where it goes — to ring about an allergy, or point a rider. */}
      <div className="mt-4 space-y-2 rounded-xl bg-canvas p-3 text-sm">
        <a href={telHref} className="flex items-center gap-2.5 font-semibold text-heading hover:text-ember-700">
          <Phone size={16} className="shrink-0 text-muted" />
          <span className="tabular-nums">{order.phone}</span>
        </a>
        <a
          href={mapsHref}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-start gap-2.5 text-body-text hover:text-ember-700"
        >
          <MapPin size={16} className="mt-0.5 shrink-0 text-muted" />
          <span className="leading-snug">{order.address}</span>
        </a>
        {riders.length > 0 && (
          <label className="flex items-center gap-2.5">
            <Bike size={16} className="shrink-0 text-muted" />
            <span className="sr-only">Rider for {order.reference}</span>
            <select
              value={order.assignedRiderId ?? ""}
              onChange={(e) => onAssign(order, e.target.value)}
              className="h-10 min-w-0 flex-1 rounded-lg border border-hairline bg-panel px-2 text-sm font-semibold text-heading focus:border-ember-500 focus:outline-none"
            >
              <option value="">No rider yet</option>
              {riders.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {unpaid && (
        <p className="mt-3 text-xs font-semibold text-muted">
          Not paid yet ({order.paymentMethod === "cash" ? "cash on delivery" : order.paymentMethod === "bank_transfer" ? "bank transfer" : order.paymentMethod === "payment_link" ? "payment link, not confirmed yet" : "pay later"}) — the rider handles payment.
        </p>
      )}
      {hint && <p className="mt-3 text-xs font-semibold text-violet-700">{hint}</p>}

      <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            disabled={action.busy}
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl bg-ember-600 px-5 text-lg font-semibold text-white transition-colors hover:bg-ember-500 disabled:opacity-60"
          >
            <Check size={20} />
            {action.busy ? "…" : action.label}
          </button>
        ) : secondaryAction ? (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            disabled={secondaryAction.busy}
            className="inline-flex min-h-14 flex-1 items-center justify-center gap-2 rounded-xl border border-hairline px-5 text-base font-semibold text-body-text transition-colors hover:bg-canvas disabled:opacity-60"
          >
            {secondaryAction.busy ? "…" : secondaryAction.label}
          </button>
        ) : (
          <span className="inline-flex min-h-14 flex-1 items-center justify-center rounded-xl bg-success-soft px-5 text-base font-semibold text-success">
            Ready — rider will collect
          </span>
        )}
        <a
          href={`/admin/orders/${order.id}/ticket`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-14 items-center gap-2 rounded-xl border border-hairline px-4 text-sm font-semibold text-body-text hover:bg-canvas"
          aria-label={`Print kitchen ticket for ${order.reference}`}
        >
          <Printer size={18} />
          Ticket
        </a>
      </div>
    </article>
  );
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
