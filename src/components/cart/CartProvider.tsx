"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * The cart lives in localStorage, not on the server.
 *
 * Nothing here is trusted at checkout: the server re-reads every price from
 * the store and recomputes the total from the slugs and option ids. This is
 * a convenience store for the browser, not a source of truth about money.
 */

const STORAGE_KEY = "kebabish-cart-v1";

export interface CartOption {
  groupId: string;
  groupLabel: string;
  optionId: string;
  optionLabel: string;
  price: number;
}

export interface CartLine {
  /** Same dish with the same extras stacks; different extras don't. */
  id: string;
  slug: string;
  name: string;
  unitPrice: number;
  options: CartOption[];
  instructions: string;
  quantity: number;
}

export type NewCartLine = Omit<CartLine, "id" | "quantity">;

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** False until localStorage has been read, so SSR and first paint agree. */
  ready: boolean;
  drawerOpen: boolean;
  add: (line: NewCartLine, quantity?: number) => void;
  setQuantity: (id: string, quantity: number) => void;
  remove: (id: string) => void;
  clear: () => void;
  openDrawer: () => void;
  closeDrawer: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function useCart(): CartValue {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside <CartProvider>");
  return context;
}

/** Line total including its extras. */
export function lineTotal(line: CartLine): number {
  const extras = line.options.reduce((sum, o) => sum + o.price, 0);
  return (line.unitPrice + extras) * line.quantity;
}

/**
 * Identity of a line: the dish, its chosen extras, and its instructions.
 * Two "Chicken Biryani, extra garlic sauce" stack into a quantity of 2;
 * one with a note about allergies stays its own line, because merging it
 * would silently drop the note from one of them.
 */
function lineId(line: NewCartLine): string {
  const options = line.options
    .map((o) => `${o.groupId}:${o.optionId}`)
    .sort()
    .join(",");
  return [line.slug, options, line.instructions.trim()].join("|");
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const [ready, setReady] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Read after mount, never during render: the server has no localStorage,
  // so reading it inline would render a different tree than it hydrates.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(JSON.parse(raw) as CartLine[]);
    } catch {
      // Corrupt or unavailable (private mode) — start empty rather than crash.
    }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Out of quota or blocked; the cart still works for this page view.
    }
  }, [lines, ready]);

  const add = useCallback((line: NewCartLine, quantity = 1) => {
    const id = lineId(line);
    setLines((prev) => {
      const existing = prev.find((l) => l.id === id);
      if (existing) {
        return prev.map((l) =>
          l.id === id ? { ...l, quantity: l.quantity + quantity } : l
        );
      }
      return [...prev, { ...line, id, quantity }];
    });
  }, []);

  const setQuantity = useCallback((id: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0
        ? prev.filter((l) => l.id !== id)
        : prev.map((l) => (l.id === id ? { ...l, quantity } : l))
    );
  }, []);

  const remove = useCallback(
    (id: string) => setLines((prev) => prev.filter((l) => l.id !== id)),
    []
  );

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + lineTotal(l), 0),
      ready,
      drawerOpen,
      add,
      setQuantity,
      remove,
      clear,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [lines, ready, drawerOpen, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
