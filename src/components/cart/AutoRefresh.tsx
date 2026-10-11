"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-runs the server component this sits in every `intervalMs`, so the order
 * page follows along on its own: first while the payment is still being
 * confirmed (a few seconds — the customer has just come back from the bank),
 * then, once paid, while the order moves through the kitchen. Pauses while
 * the tab is in the background so a forgotten tab isn't hammering the server.
 */
export default function AutoRefresh({ intervalMs }: { intervalMs: number }) {
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [router, intervalMs]);

  return null;
}
