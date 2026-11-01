"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import type { LedgerKind, LedgerRow } from "@/lib/rewards";

const STORAGE_KEY = "kebabish-points-seen-v1";
const RECENT_DAYS = 30;
const SHOWN = 4;

const n = (value: number) => Math.abs(value).toLocaleString("en-GB");

/** The customer's words for each movement. A referral never says whose order it was. */
function headline(row: LedgerRow): string {
  const on = row.orderReference ? ` on ${row.orderReference}` : "";
  const words: Record<LedgerKind, string> = {
    earn: `You earned ${n(row.points)} points${on}`,
    welcome: `Your ${n(row.points)} welcome points are here`,
    redeem: `You used ${n(row.points)} points${on}`,
    restore: `${n(row.points)} points came back to your account`,
    clawback: `${n(row.points)} points were removed after a refund`,
    adjust: `${row.points > 0 ? "We added" : "We removed"} ${n(row.points)} points`,
    referral: `A friend ordered: you got ${n(row.points)} points`,
  };
  return words[row.kind] ?? `${n(row.points)} points`;
}

/**
 * What changed on the account lately, newest first. "New" means since the last visit on this
 * device: it is a reminder, not a record, so it is kept in the browser and the full history
 * stays on the Kebabish Punten card.
 */
export default function PointsUpdates({ rows }: { rows: LedgerRow[] }) {
  const [clock, setClock] = useState<{ now: number; seenAt: number } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const now = Date.now();
      let seenAt = now;
      try {
        seenAt = Number(window.localStorage.getItem(STORAGE_KEY)) || 0;
        window.localStorage.setItem(STORAGE_KEY, String(now));
      } catch {
        // No storage: nothing is marked new.
      }
      setClock({ now, seenAt });
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  // Reading the clock in render would differ between server and browser, so the list waits for mount.
  if (clock === null) return null;
  const { now, seenAt } = clock;
  const recent = rows
    .filter((row) => now - Date.parse(row.createdAt) < RECENT_DAYS * 86_400_000)
    .slice(0, SHOWN);
  if (recent.length === 0) return null;
  const fresh = recent.filter((row) => Date.parse(row.createdAt) > seenAt).length;

  return (
    <Card>
      <div className="flex items-center gap-2.5">
        <Bell size={17} aria-hidden="true" className="text-ember-600" />
        <h2 className="font-display text-base font-semibold text-heading">Updates</h2>
        {fresh > 0 && (
          <span className="rounded-full bg-ember-600 px-2 py-0.5 text-xs font-semibold text-cream-50">{fresh} new</span>
        )}
      </div>
      <ul className="mt-3 space-y-2 text-sm">
        {recent.map((row) => (
          <li key={row.id} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                Date.parse(row.createdAt) > seenAt ? "bg-ember-600" : "bg-hairline"
              }`}
            />
            <span className="min-w-0 text-body-text">{headline(row)}</span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
