"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, Bell, Check, Clock, MapPin, X } from "lucide-react";
import { acceptOrderAction, declineOrderAction } from "@/app/admin/(dashboard)/orders/actions";
import { useToast } from "@/components/admin/ui/Toast";

interface PendingOrder {
  id: string;
  reference: string;
  customerName: string;
  town: string;
  placedAt: string;
  /** When the payment landed — the clock the wait is measured from. */
  paidAt: string | null;
  total: string;
  itemSummary: string;
}

const POLL_MS = 8000;
/** Wait thresholds, in seconds: amber, then red (the server emails at the same 5 min). */
const WARN_AFTER = 3 * 60;
const URGENT_AFTER = 5 * 60;

function waitedSeconds(order: PendingOrder, now: number) {
  return Math.max(0, Math.floor((now - Date.parse(order.paidAt ?? order.placedAt)) / 1000));
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const BEEP_MS = 1800;

/** Two short beeps via Web Audio — no audio file to host, and it works
 * even the first time this ever runs since it's synthesised on the spot. */
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.22].forEach((delay) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      const start = ctx.currentTime + delay;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.35, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.2);
    });
    setTimeout(() => ctx.close(), 500);
  } catch {
    // Autoplay can be blocked before any click has happened on the page —
    // the popup itself still appears, sound just doesn't lead it.
  }
}

/**
 * Polls for orders that are paid but not yet accepted/declined, and puts a
 * modal in front of whoever's looking with Accept/Decline — plus a
 * repeating beep for as long as any are waiting. Mounted once in
 * AdminShellClient, so it's live on every admin page for owner/staff/
 * manager (not rider — accepting an order is a kitchen decision).
 */
export default function NewOrderAlert() {
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const { toast } = useToast();

  // One-second tick for the "waiting" clocks — only while something is waiting.
  useEffect(() => {
    if (orders.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [orders.length]);

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/pending-orders", { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as { orders: PendingOrder[] };
      setOrders(data.orders);
    } catch {
      // A missed poll just means the next one (8s later) tries again.
    }
  }, []);

  useEffect(() => {
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, [poll]);

  useEffect(() => {
    if (orders.length === 0) return;
    beep();
    const id = setInterval(beep, BEEP_MS);
    return () => clearInterval(id);
  }, [orders.length]);

  async function respond(orderId: string, action: "accept" | "decline") {
    setBusyId(orderId);
    const result = await (action === "accept" ? acceptOrderAction : declineOrderAction)(orderId);
    setBusyId(null);
    if (!result.ok) {
      toast(result.message ?? "Couldn't do that — try again.", "error");
      return;
    }
    setOrders((prev) => prev.filter((o) => o.id !== orderId));
    toast(
      result.message ?? (action === "accept" ? "Order accepted." : "Order declined."),
      result.message?.includes("refund failed") ? "error" : "success"
    );
  }

  if (orders.length === 0) return null;

  const longest = Math.max(...orders.map((o) => waitedSeconds(o, now)));
  const urgent = longest >= URGENT_AFTER;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-heading/50 p-4">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl bg-panel shadow-2xl">
        {urgent && (
          <div className="flex items-center gap-2 bg-danger px-5 py-2.5 text-sm font-semibold text-white">
            <AlertTriangle size={16} />
            Urgent — a customer has been waiting over 5 minutes
          </div>
        )}
        <div className="flex items-center gap-2 border-b border-hairline p-5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
            <Bell size={17} />
          </span>
          <div>
            <p className="font-display text-lg font-semibold text-heading">
              {orders.length === 1 ? "New order" : `${orders.length} new orders`}
            </p>
            <p className="text-xs text-muted">Accept to start preparing, or decline.</p>
          </div>
        </div>

        <ul className="divide-y divide-hairline">
          {orders.map((order) => (
            <li key={order.id} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-display text-base font-semibold text-heading">
                    {order.reference}
                  </p>
                  <p className="truncate text-sm text-body-text">{order.customerName}</p>
                </div>
                <p className="shrink-0 font-display text-base font-semibold text-heading">
                  {order.total}
                </p>
              </div>

              <p className="mt-2 flex items-start gap-1.5 text-xs text-muted">
                <MapPin size={13} className="mt-0.5 shrink-0" />
                {order.town}
              </p>
              {(() => {
                const waited = waitedSeconds(order, now);
                const tone =
                  waited >= URGENT_AFTER
                    ? "bg-danger-soft text-danger"
                    : waited >= WARN_AFTER
                      ? "bg-warn-soft text-warn"
                      : "bg-canvas text-muted";
                return (
                  <p className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${tone}`}>
                    <Clock size={12} />
                    Waiting {mmss(waited)}
                  </p>
                );
              })()}
              <p className="mt-1 text-sm text-body-text">{order.itemSummary}</p>

              <div className="mt-4 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => respond(order.id, "decline")}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-danger-soft hover:text-danger disabled:opacity-60"
                >
                  <X size={15} />
                  Decline
                </button>
                <button
                  type="button"
                  disabled={busyId === order.id}
                  onClick={() => respond(order.id, "accept")}
                  className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
                >
                  <Check size={15} />
                  Accept order
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
