"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChefHat, Clock, Maximize2, Printer, StickyNote, Volume2, WifiOff } from "lucide-react";
import { advanceKitchenOrderAction } from "@/app/kitchen/actions";

export interface BoardOrder {
  id: string;
  reference: string;
  firstName: string;
  status: "new" | "preparing" | "ready";
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

const POLL_MS = 5000;
const BEEP_MS = 1800;
/** Seconds an unaccepted order may wait before the card turns amber, then red. */
const WARN_AFTER = 3 * 60;
const URGENT_AFTER = 5 * 60;

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

function slotLabel(o: BoardOrder): string | null {
  if (!o.deliveryDate || !o.slotStart) return null;
  const [y, m, d] = o.deliveryDate.split("-").map(Number);
  const day = new Intl.DateTimeFormat("nl-NL", { weekday: "short", day: "numeric", month: "short" }).format(
    new Date(y, m - 1, d)
  );
  return `${day} · ${o.slotStart}–${o.slotEnd}`;
}

/** Sort key for "which one is due soonest": date + slot start; no slot sorts last. */
const dueKey = (o: BoardOrder) => (o.deliveryDate && o.slotStart ? `${o.deliveryDate} ${o.slotStart}` : "9999");

/**
 * The live orders board for the kitchen: a paid order appears the moment it
 * arrives and the screen beeps — repeatedly, for every order still waiting —
 * until someone accepts it. A card shows what to cook, the customer's note
 * (marked as an allergy check), and one big button for the next step.
 *
 * Order of the board: orders waiting to be accepted first (longest wait on
 * top), then what's being prepared (soonest delivery slot first), then what's
 * ready for the rider.
 */
export default function KitchenBoard({ endpoint = "/api/kitchen/orders" }: { endpoint?: string }) {
  const [orders, setOrders] = useState<BoardOrder[]>([]);
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
      const data = (await res.json()) as { orders: BoardOrder[] };
      setOrders(data.orders);
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
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
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

  async function advance(order: BoardOrder, to: "preparing" | "ready") {
    setBusyId(order.id);
    setError(null);
    const result = await advanceKitchenOrderAction(order.id, to);
    setBusyId(null);
    if (!result.ok) {
      setError(result.message ?? "That didn't work — try again.");
      return;
    }
    // Reflect it at once; the next poll confirms.
    setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: to, acceptedAt: new Date().toISOString() } : o)));
    poll();
  }

  const urgent = waiting.some((o) => (now - Date.parse(o.paidAt ?? o.placedAt)) / 1000 >= URGENT_AFTER);

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
                return (
                  <Card
                    key={o.id}
                    order={o}
                    tone={seconds >= URGENT_AFTER ? "danger" : seconds >= WARN_AFTER ? "warn" : "new"}
                    clock={`Waiting ${mmss(seconds)}`}
                    action={{ label: "Accept order", onClick: () => advance(o, "preparing"), busy: busyId === o.id }}
                  />
                );
              })}
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
                    clock={since != null ? `Cooking ${mmss(since)}` : undefined}
                    action={{ label: "Mark ready for the rider", onClick: () => advance(o, "ready"), busy: busyId === o.id }}
                  />
                );
              })}
            </Section>
          )}

          {ready.length > 0 && (
            <Section title="Ready — waiting for the rider" count={ready.length} tone="ok">
              {ready.map((o) => (
                <Card key={o.id} order={o} tone="ready" />
              ))}
            </Section>
          )}
        </div>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  tone,
  children,
}: {
  title: string;
  count: number;
  tone: "ember" | "danger" | "warn" | "ok";
  children: React.ReactNode;
}) {
  const dot = { ember: "bg-ember-600", danger: "bg-danger", warn: "bg-warn", ok: "bg-success" }[tone];
  return (
    <section>
      <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-semibold text-heading">
        <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
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
}: {
  order: BoardOrder;
  tone: "new" | "warn" | "danger" | "prep" | "ready";
  clock?: string;
  action?: { label: string; onClick: () => void; busy: boolean };
}) {
  const border = {
    new: "border-ember-600",
    warn: "border-warn",
    danger: "border-danger",
    prep: "border-hairline",
    ready: "border-success",
  }[tone];
  const clockTone = { new: "bg-canvas text-muted", warn: "bg-warn-soft text-warn", danger: "bg-danger text-white", prep: "bg-canvas text-muted", ready: "" }[tone];
  const slot = slotLabel(order);
  const unpaid = order.paymentStatus !== "paid";

  return (
    <article className={`flex flex-col rounded-2xl border-2 bg-panel p-4 shadow-sm ${border}`}>
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-2xl font-semibold leading-none text-heading">{order.reference}</p>
          <p className="mt-1 text-sm text-muted">{order.firstName}</p>
        </div>
        {clock && (
          <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold tabular-nums ${clockTone}`}>
            {tone === "danger" ? <AlertTriangle size={14} /> : <Clock size={14} />}
            {clock}
          </span>
        )}
      </header>

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

      {unpaid && (
        <p className="mt-3 text-xs font-semibold text-muted">
          Not paid yet ({order.paymentMethod === "cash" ? "cash on delivery" : order.paymentMethod === "bank_transfer" ? "bank transfer" : "pay later"}) — the rider handles payment.
        </p>
      )}

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
