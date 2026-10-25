"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * The last order placed on this device, remembered so a returning customer can order
 * the same again in one tap — signed in or not.
 *
 * Written by the confirmation page once the order is paid (`RememberLastOrder`); read
 * by the "Order again" card. It holds only what the card shows (dish names, counts, a
 * photo) plus the order reference and its access token, which is what
 * `/api/reorder` needs to rebuild the lines against today's menu. No name, address or
 * phone number is stored. Like everything else in storage it is untrusted on the way
 * back in, and `readLastOrder` checks every field.
 */

export interface LastOrder {
  ref: string;
  token: string;
  /** When it was placed on this device (ms). */
  at: number;
  totalCents: number;
  items: { name: string; quantity: number; image?: string }[];
}

const STORAGE_KEY = "kebabish-last-order-v1";
const CHANGE_EVENT = "kebabish-last-order-change";
/** Older than this, "the same as last time" isn't much of a shortcut any more. */
const MAX_AGE_MS = 180 * 86_400_000;

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function getSnapshot(): string {
  try {
    return window.localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

/** null on the server and the first client paint, so the two agree. */
const getServerSnapshot = (): string | null => null;

export function readLastOrder(raw: string | null): LastOrder | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Record<string, unknown> | null;
    if (!v || typeof v !== "object") return null;
    if (typeof v.ref !== "string" || !/^[A-Z0-9#-]{4,40}$/.test(v.ref)) return null;
    if (typeof v.token !== "string" || !/^[a-f0-9]{16,64}$/.test(v.token)) return null;
    const at = typeof v.at === "number" ? v.at : 0;
    if (Date.now() - at > MAX_AGE_MS) return null;
    const items = Array.isArray(v.items)
      ? v.items
          .filter(
            (i): i is { name: string; quantity: number; image?: unknown } =>
              typeof i?.name === "string" && typeof i?.quantity === "number"
          )
          .slice(0, 30)
          .map((i) => ({
            name: i.name.slice(0, 80),
            quantity: Math.min(Math.max(Math.round(i.quantity), 1), 50),
            ...(typeof i.image === "string" && i.image.length < 600 ? { image: i.image } : {}),
          }))
      : [];
    if (items.length === 0) return null;
    const totalCents =
      typeof v.totalCents === "number" && Number.isFinite(v.totalCents) ? Math.round(v.totalCents) : 0;
    return { ref: v.ref, token: v.token, at, totalCents, items };
  } catch {
    return null;
  }
}

export function saveLastOrder(order: LastOrder) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(order));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // No storage (private mode): there is simply no "order again" on this device.
  }
}

/** `undefined` while storage hasn't been read yet; `null` when there is no last order. */
export function useLastOrder(): LastOrder | null | undefined {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return useMemo(() => (raw === null ? undefined : readLastOrder(raw)), [raw]);
}
