"use client";

import { useEffect } from "react";
import { saveLastOrder, type LastOrder } from "@/components/reorder/last-order";

/**
 * Remembers a paid order on this device for the "Order again" card. Rendered by the
 * confirmation page only once the order is paid, so a checkout that was abandoned at
 * the bank never becomes "your last order".
 */
export default function RememberLastOrder({
  reference,
  token,
  totalCents,
  items,
}: {
  reference: string;
  token: string;
  totalCents: number;
  items: LastOrder["items"];
}) {
  useEffect(() => {
    saveLastOrder({ ref: reference, token, totalCents, items, at: Date.now() });
    // Once per order: a refresh of the same page must not keep rewriting it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference]);
  return null;
}
