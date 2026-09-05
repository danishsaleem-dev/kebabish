"use client";

import { useEffect } from "react";
import { useCart } from "@/components/cart/CartProvider";

/**
 * Empties the cart once an order is confirmed paid.
 *
 * Deliberately not cleared when checkout *starts*: if the payment fails or
 * the customer backs out at Mollie, they come back to a cart that still
 * has their order in it rather than an empty one.
 */
export default function ClearCartOnPaid() {
  const { clear, ready, lines } = useCart();

  useEffect(() => {
    if (ready && lines.length > 0) clear();
  }, [ready, lines.length, clear]);

  return null;
}
