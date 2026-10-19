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

/**
 * A promo code the visitor picked up (from the promotion popup) and hasn't spent
 * yet. Kept in its own key so the cart's saved format is untouched. Like
 * everything here it is only a convenience: checkout re-validates the code on the
 * server against the real basket, so a hand-edited value can't buy a discount.
 */
const PROMO_KEY = "kebabish-promo-v1";
const PROMO_SHAPE = /^[A-Z0-9-]{3,30}$/;

/** Normalise a code; anything that couldn't be a real one becomes null. */
export function cleanPromoCode(value: unknown): string | null {
  const code = typeof value === "string" ? value.trim().toUpperCase() : "";
  return PROMO_SHAPE.test(code) ? code : null;
}

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
  /**
   * The dish photo, so the cart and drawer can show what was ordered rather
   * than a list of names. Optional, and never part of the line's identity: a
   * basket saved before this existed (or one whose photo changed in /admin)
   * is backfilled from the menu by the check below, not treated as a
   * different line.
   */
  image?: string;
}

export type NewCartLine = Omit<CartLine, "id" | "quantity">;

/**
 * What comes back out of localStorage is untrusted: it may be a basket saved by an
 * older version of the site, hand-edited, cut short by a full disk, or written by a
 * second tab. This provider sits in the layout, so one malformed line used to take
 * the *whole site* down ("Er ging iets mis" on every page, on every reload, until the
 * visitor cleared their browser data). Anything that isn't a well-formed line is
 * dropped instead; the server re-prices whatever is left at checkout anyway.
 */
function sanitizeLines(raw: unknown): CartLine[] {
  if (!Array.isArray(raw)) return [];
  const finite = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
  const out: CartLine[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;
    const l = entry as Record<string, unknown>;
    if (typeof l.id !== "string" || typeof l.slug !== "string" || typeof l.name !== "string") continue;
    if (!finite(l.unitPrice) || l.unitPrice < 0) continue;

    const options: CartOption[] = [];
    if (l.options !== undefined && !Array.isArray(l.options)) continue;
    for (const o of (l.options as unknown[] | undefined) ?? []) {
      if (!o || typeof o !== "object") continue;
      const opt = o as Record<string, unknown>;
      if (
        typeof opt.groupId !== "string" ||
        typeof opt.optionId !== "string" ||
        typeof opt.groupLabel !== "string" ||
        typeof opt.optionLabel !== "string" ||
        !finite(opt.price)
      ) {
        continue;
      }
      options.push({
        groupId: opt.groupId,
        groupLabel: opt.groupLabel,
        optionId: opt.optionId,
        optionLabel: opt.optionLabel,
        price: opt.price,
      });
    }

    const quantity = finite(l.quantity) ? Math.min(50, Math.max(1, Math.round(l.quantity))) : 1;
    out.push({
      id: l.id,
      slug: l.slug,
      name: l.name,
      unitPrice: l.unitPrice,
      options,
      instructions: typeof l.instructions === "string" ? l.instructions : "",
      quantity,
      ...(typeof l.image === "string" ? { image: l.image } : {}),
    });
  }
  return out;
}

/** Why a line can't be ordered any more (it is simply absent when it can). */
export type CartIssue = "soldOut" | "unavailable" | "optionsChanged" | "insufficient";

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  /** False until localStorage has been read, so SSR and first paint agree. */
  ready: boolean;
  drawerOpen: boolean;
  /** Lines (by id) whose dish was sold out / taken off the menu / changed since it was added. */
  issues: Record<string, CartIssue>;
  /** Lines whose price was just brought in line with the menu. */
  repriced: string[];
  /** True while any line can't be ordered — payment must wait until it's removed. */
  blocked: boolean;
  /** A promo code waiting to be applied at checkout, or null. */
  promoCode: string | null;
  /** Save (or, with null, forget) the pending promo code. */
  setPromoCode: (code: string | null) => void;
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
  const [issues, setIssues] = useState<Record<string, CartIssue>>({});
  const [repriced, setRepriced] = useState<string[]>([]);
  const [promoCode, setPromoCodeState] = useState<string | null>(null);

  // Read after mount, never during render: the server has no localStorage,
  // so reading it inline would render a different tree than it hydrates.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setLines(sanitizeLines(JSON.parse(raw)));
    } catch {
      // Corrupt or unavailable (private mode) — start empty rather than crash.
    }
    try {
      setPromoCodeState(cleanPromoCode(window.localStorage.getItem(PROMO_KEY)));
    } catch {
      // Same: no storage, no remembered code.
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

  useEffect(() => {
    if (!ready) return;
    try {
      if (promoCode) window.localStorage.setItem(PROMO_KEY, promoCode);
      else window.localStorage.removeItem(PROMO_KEY);
    } catch {
      // Blocked storage: the code still works until this page is closed.
    }
  }, [promoCode, ready]);

  // Keep the basket honest against the live menu. A dish can sell out, be
  // hidden, or have its extras changed after someone added it — they should
  // hear about it here, with the rest of their basket intact, not meet a
  // generic error when they press pay. Re-checked when the *contents* change
  // (not on quantity or price edits), when the tab comes back into view, and
  // once a minute while the page stays open. The server re-validates
  // everything at payment regardless; this is the friendly early warning.
  const contents = lines.map((l) => l.id).join("\n");
  useEffect(() => {
    if (!ready) return;
    if (lines.length === 0) {
      setIssues({});
      setRepriced([]);
      return;
    }

    let cancelled = false;
    const snapshot = lines;

    async function check() {
      try {
        const res = await fetch("/api/cart/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            lines: snapshot.map((l) => ({
              slug: l.slug,
              quantity: l.quantity,
              options: l.options.map((o) => ({ groupId: o.groupId, optionId: o.optionId })),
            })),
          }),
          cache: "no-store",
        });
        if (!res.ok || cancelled) return;
        const { results } = (await res.json()) as {
          results: (
            | {
                status: "ok";
                unitPrice: number;
                optionPrices: Record<string, number>;
                image?: string;
              }
            | { status: CartIssue }
          )[];
        };
        if (cancelled || results.length !== snapshot.length) return;

        const nextIssues: Record<string, CartIssue> = {};
        const priceFixes = new Map<
          string,
          { unitPrice: number; optionPrices: Record<string, number> }
        >();
        // A photo arriving (or changing) is not a price change — it must not
        // raise the "price updated" notice — so it is tracked separately.
        const imageFixes = new Map<string, string>();
        snapshot.forEach((line, i) => {
          const r = results[i];
          if (r.status !== "ok") {
            nextIssues[line.id] = r.status;
            return;
          }
          if (r.image && r.image !== line.image) imageFixes.set(line.id, r.image);
          const optionsDiffer = line.options.some(
            (o) => r.optionPrices[`${o.groupId}:${o.optionId}`] !== o.price
          );
          if (r.unitPrice !== line.unitPrice || optionsDiffer) {
            priceFixes.set(line.id, { unitPrice: r.unitPrice, optionPrices: r.optionPrices });
          }
        });
        setIssues(nextIssues);

        if (imageFixes.size > 0) {
          setLines((prev) =>
            prev.map((l) => {
              const image = imageFixes.get(l.id);
              return image ? { ...l, image } : l;
            })
          );
        }

        if (priceFixes.size > 0) {
          setLines((prev) =>
            prev.map((l) => {
              const fix = priceFixes.get(l.id);
              if (!fix) return l;
              return {
                ...l,
                unitPrice: fix.unitPrice,
                options: l.options.map((o) => ({
                  ...o,
                  price: fix.optionPrices[`${o.groupId}:${o.optionId}`] ?? o.price,
                })),
              };
            })
          );
          setRepriced((prev) => [...new Set([...prev, ...priceFixes.keys()])]);
        }
      } catch {
        // Offline or a hiccup: keep what we last knew. Payment re-checks anyway.
      }
    }

    const first = setTimeout(check, 250);
    const every = setInterval(check, 60_000);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelled = true;
      clearTimeout(first);
      clearInterval(every);
      document.removeEventListener("visibilitychange", onVisible);
    };
    // `contents` stands for "the lines, ignoring quantities and prices".
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, contents]);

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

  // An order that has gone through has used its code, so it goes with the basket.
  const clear = useCallback(() => {
    setLines([]);
    setPromoCodeState(null);
  }, []);

  const setPromoCode = useCallback((code: string | null) => setPromoCodeState(cleanPromoCode(code)), []);

  const value = useMemo<CartValue>(
    () => ({
      lines,
      count: lines.reduce((sum, l) => sum + l.quantity, 0),
      subtotal: lines.reduce((sum, l) => sum + lineTotal(l), 0),
      ready,
      drawerOpen,
      issues,
      repriced,
      blocked: Object.keys(issues).length > 0,
      promoCode,
      setPromoCode,
      add,
      setQuantity,
      remove,
      clear,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
    }),
    [lines, ready, drawerOpen, issues, repriced, promoCode, setPromoCode, add, setQuantity, remove, clear]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
