"use client";

import { useEffect, useState } from "react";
import { Bell } from "lucide-react";

const STORAGE_KEY = "kebabish-points-seen-v1";
const RECENT_DAYS = 30;
const SHOWN = 4;

/** One movement on the account, with its sentence already written on the server. */
export type UpdateRow = {
  id: string;
  createdAt: string;
  /** "You earned 450 points on KBB-2026-000123" — translated by the page. */
  headline: string;
};

/**
 * What changed on the account lately, newest first. "New" means since the
 * last visit on this device: it is a reminder, not a record, so the mark is
 * kept in the browser and the full history lives on the points page.
 *
 * The count of new rows can only be known in the browser, so the "N new"
 * badge is built here from a one-placeholder template rather than a
 * translator — this component sits outside the locale routing and has no
 * next-intl provider above it.
 */
export default function PointsUpdates({
  rows,
  title,
  newTemplate,
}: {
  rows: UpdateRow[];
  title: string;
  /** Contains `{count}`, e.g. "{count} nieuw". */
  newTemplate: string;
}) {
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
    <section className="rounded-2xl border border-hairline bg-panel p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-6">
      <div className="flex items-center gap-2.5">
        <Bell size={17} aria-hidden="true" className="text-ember-600" />
        <h2 className="font-display text-base font-semibold text-heading">{title}</h2>
        {fresh > 0 && (
          <span className="rounded-full bg-ember-600 px-2 py-0.5 text-xs font-semibold text-cream-50">
            {newTemplate.replace("{count}", String(fresh))}
          </span>
        )}
      </div>
      <ul className="mt-3 space-y-2.5 text-sm">
        {recent.map((row) => (
          <li key={row.id} className="flex items-start gap-2.5">
            <span
              aria-hidden="true"
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                Date.parse(row.createdAt) > seenAt ? "bg-ember-600" : "bg-hairline"
              }`}
            />
            <span className="min-w-0 text-body-text">{row.headline}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
