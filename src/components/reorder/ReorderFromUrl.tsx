"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useCart } from "@/components/cart/CartProvider";
import { useReorder } from "@/components/reorder/useReorder";

/**
 * Handles `?reorder=<reference>&t=<token>` on any public page — the "Order again"
 * buttons on the customer dashboard link here, since the basket lives in the public
 * site and the dashboard sits outside it. Adds the order's lines, opens the basket,
 * and strips the two parameters so a refresh (or a shared link) doesn't add it twice.
 * What couldn't be put back is announced in a short notice.
 */
export default function ReorderFromUrl() {
  const t = useTranslations("reorder");
  const params = useSearchParams();
  const { ready } = useCart();
  const { state, run } = useReorder();
  const done = useRef(false);

  const ref = params.get("reorder");
  const token = params.get("t");

  useEffect(() => {
    if (!ready || done.current || !ref || !token) return;
    done.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete("reorder");
    url.searchParams.delete("t");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
    void run(ref, token);
  }, [ready, ref, token, run]);

  // The notice clears itself after a few seconds; the basket drawer carries the rest.
  const [hidden, setHidden] = useState(false);
  const settled = state.status === "done" || state.status === "error";
  useEffect(() => {
    if (!settled) return;
    const timer = window.setTimeout(() => setHidden(true), 7000);
    return () => window.clearTimeout(timer);
  }, [settled]);

  const message =
    state.status === "done"
      ? state.added === 0
        ? t("noneAvailable")
        : state.skipped.length > 0
          ? t("skipped", { names: state.skipped.join(", ") })
          : null
      : state.status === "error"
        ? t("error")
        : null;

  if (!message || hidden) return null;

  return (
    <p
      role="status"
      className="toast-in fixed inset-x-4 bottom-[calc(var(--dock,0px)+1rem)] z-[70] mx-auto max-w-md rounded-2xl bg-charcoal-800 px-5 py-3.5 text-sm text-cream-100 shadow-xl shadow-charcoal-950/30"
    >
      {message}
    </p>
  );
}
