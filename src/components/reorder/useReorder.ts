"use client";

import { useCallback, useState } from "react";
import { useLocale } from "next-intl";
import { useCart } from "@/components/cart/CartProvider";
import type { Reorder } from "@/lib/reorder";

export type ReorderState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; added: number; skipped: string[] }
  | { status: "error" };

/**
 * Put a past order back in the basket. The lines come from `/api/reorder`, already
 * matched to today's menu and prices; whatever is no longer available comes back as
 * `skipped` so the caller can say so. Opens the basket drawer when something was added.
 */
export function useReorder() {
  const { add, openDrawer } = useCart();
  const locale = useLocale();
  const [state, setState] = useState<ReorderState>({ status: "idle" });

  const run = useCallback(
    async (ref: string, token: string) => {
      setState({ status: "loading" });
      try {
        const params = new URLSearchParams({ ref, t: token, locale });
        const res = await fetch(`/api/reorder?${params}`, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as Reorder;
        for (const line of data.lines) {
          const { quantity, ...rest } = line;
          add(rest, quantity);
        }
        setState({ status: "done", added: data.lines.length, skipped: data.skipped });
        if (data.lines.length > 0) openDrawer();
        return data;
      } catch {
        setState({ status: "error" });
        return null;
      }
    },
    [add, openDrawer, locale]
  );

  return { state, run };
}
