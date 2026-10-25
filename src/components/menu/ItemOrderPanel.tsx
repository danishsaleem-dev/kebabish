"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Check, Flame, MessageSquarePlus, Minus, Plus, ShoppingBag } from "lucide-react";
import { useCart, type CartOption } from "@/components/cart/CartProvider";
import Suggestions from "@/components/menu/Suggestions";
import StockRequestDialog from "@/components/menu/StockRequestDialog";
import { formatEuro } from "@/lib/money";
import type { PublicMenuItem } from "@/lib/public-menu";

/**
 * Extras, a note for the kitchen, quantity, add-to-basket — the dish page's buy box.
 *
 * - **Extras are tiles**, two per row from `sm`, each with its own radio/checkbox mark,
 *   price and a "chosen" state. Every group says whether it is required, the rule
 *   ("choose 1", "up to 3"), and how many are picked.
 * - **The add button is never a dead grey button.** Tapping it before a required choice
 *   is made scrolls to the first group still missing one, outlines it and says what is
 *   needed ("Choose first: Sauce"). Required choices are still enforced on the server.
 * - **The kitchen note** is one line ("Add a note for the kitchen") until it is wanted.
 * - **On a phone** a sticky bar with the running total appears just above the order bar
 *   once the main button has scrolled out of view, so adding never means scrolling
 *   back up. While it shows it sets `html[data-addbar]`, which lifts the floating
 *   WhatsApp/halal/promotion elements above it (globals.css). It also shows before the
 *   main button has come into view, as delivery apps do.
 *
 * A dish with no price can't be added: the cart would carry a line it can't total and
 * checkout would be impossible. Those fall back to the WhatsApp path. A sold-out dish
 * offers the "request it" form instead.
 */
export default function ItemOrderPanel({
  item,
  isOpen,
  whatsappHref,
}: {
  item: PublicMenuItem;
  isOpen: boolean;
  whatsappHref: string;
}) {
  const t = useTranslations("item");
  const tMenu = useTranslations("menu");
  const tCart = useTranslations("cart");
  const tRequest = useTranslations("stockRequest");
  const { add, openDrawer } = useCart();

  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [instructions, setInstructions] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const [flagged, setFlagged] = useState<string[]>([]);
  // Once something has been added the "often bought with" strip appears below the
  // button and stays — changing an extra afterwards must not make it vanish.
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const groupRefs = useRef<Record<string, HTMLFieldSetElement | null>>({});
  const mainButton = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(false);

  const orderable = item.price != null && !item.soldOut && isOpen;

  const chosen = useMemo<CartOption[]>(() => {
    const out: CartOption[] = [];
    for (const group of item.optionGroups) {
      for (const id of selected[group.id] ?? []) {
        const option = group.options.find((o) => o.id === id);
        if (option) {
          out.push({
            groupId: group.id,
            groupLabel: group.label,
            optionId: option.id,
            optionLabel: option.label,
            price: option.price,
          });
        }
      }
    }
    return out;
  }, [selected, item.optionGroups]);

  const unitTotal = (item.price ?? 0) + chosen.reduce((s, o) => s + o.price, 0);
  const total = unitTotal * quantity;

  const missingRequired = item.optionGroups.filter(
    (g) => (selected[g.id]?.length ?? 0) < g.minChoices
  );

  // The sticky phone bar.
  useEffect(() => {
    const el = mainButton.current;
    if (!el || !orderable) return;
    // Whenever the main button is off screen — still below the fold, or scrolled past.
    const observer = new IntersectionObserver(([entry]) => setBarVisible(!entry.isIntersecting));
    observer.observe(el);
    return () => observer.disconnect();
  }, [orderable]);

  useEffect(() => {
    const root = document.documentElement;
    if (barVisible) root.setAttribute("data-addbar", "");
    else root.removeAttribute("data-addbar");
    return () => root.removeAttribute("data-addbar");
  }, [barVisible]);

  function toggle(groupId: string, optionId: string, max: number) {
    setJustAdded(false);
    setFlagged((prev) => prev.filter((id) => id !== groupId));
    setSelected((prev) => {
      const current = prev[groupId] ?? [];

      if (max === 1) {
        // Radio behaviour, but clicking the chosen one clears it when the
        // group is optional — otherwise there's no way to undo a pick.
        return { ...prev, [groupId]: current[0] === optionId ? [] : [optionId] };
      }

      if (current.includes(optionId)) {
        return { ...prev, [groupId]: current.filter((id) => id !== optionId) };
      }
      if (current.length >= max) return prev;
      return { ...prev, [groupId]: [...current, optionId] };
    });
  }

  function handleAdd() {
    if (!orderable) return;
    if (missingRequired.length > 0) {
      // Show the way rather than refusing silently.
      setFlagged(missingRequired.map((g) => g.id));
      const first = groupRefs.current[missingRequired[0].id];
      first?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    add(
      {
        slug: item.slug,
        name: item.name,
        image: item.image,
        unitPrice: item.price ?? 0,
        options: chosen,
        instructions: instructions.trim(),
      },
      quantity
    );
    setJustAdded(true);
    setSuggestOpen(true);
    openDrawer();
  }

  const missingNames = missingRequired.map((g) => g.label).join(", ");

  return (
    <div className="space-y-6">
      {item.optionGroups.map((group) => {
        const picked = selected[group.id] ?? [];
        const single = group.maxChoices === 1;
        const required = group.minChoices > 0;
        const isFlagged = flagged.includes(group.id);
        const rule =
          required
            ? group.minChoices === group.maxChoices
              ? t("chooseExactly", { min: group.minChoices })
              : t("chooseAtLeast", { min: group.minChoices })
            : single
              ? t("chooseOne")
              : t("chooseUpTo", { max: group.maxChoices });

        return (
          <fieldset
            key={group.id}
            ref={(el) => {
              groupRefs.current[group.id] = el;
            }}
            className={`scroll-mt-32 rounded-3xl transition-[box-shadow,background-color] duration-500 ${
              isFlagged ? "bg-ember-600/5 p-3 ring-2 ring-ember-600/60 sm:p-4" : ""
            }`}
          >
            <legend className="block w-full">
              <span className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2.5">
                  <span className="font-display text-base font-semibold text-charcoal-600">{group.label}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                      required ? "bg-ember-600 text-cream-50" : "bg-charcoal-600/8 text-charcoal-600/70"
                    }`}
                  >
                    {required ? t("required") : t("optional")}
                  </span>
                </span>
                <span className="text-xs text-ink/55">
                  {rule}
                  {group.maxChoices > 1 && (
                    <span className="ml-2 font-semibold tabular-nums text-charcoal-600/70">
                      {t("pickedCount", { count: picked.length, max: group.maxChoices })}
                    </span>
                  )}
                </span>
              </span>
            </legend>

            {isFlagged && (
              <p role="alert" className="mt-2 flex items-center gap-1.5 text-sm font-semibold text-ember-700">
                <AlertCircle size={15} aria-hidden="true" />
                {t("chooseFirst", { groups: group.label })}
              </p>
            )}

            <div className="mt-2.5 grid grid-cols-1 gap-2 min-[400px]:grid-cols-2">
              {group.options.map((option) => {
                const isPicked = picked.includes(option.id);
                const atLimit = !single && picked.length >= group.maxChoices;

                return (
                  <label
                    key={option.id}
                    className={`group/opt relative flex cursor-pointer items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 transition-[border-color,background-color,transform] duration-200 active:scale-[0.98] ${
                      isPicked
                        ? "border-ember-600 bg-ember-600/[0.06]"
                        : "border-charcoal-600/10 bg-cream-50 hover:border-charcoal-600/25"
                    } ${atLimit && !isPicked ? "cursor-not-allowed opacity-45" : ""}`}
                  >
                    <input
                      type={single ? "radio" : "checkbox"}
                      name={group.id}
                      checked={isPicked}
                      disabled={atLimit && !isPicked}
                      onChange={() => toggle(group.id, option.id, group.maxChoices)}
                      className="peer sr-only"
                    />
                    {/* The mark: a ring for one-of, a square for several. */}
                    <span
                      aria-hidden="true"
                      className={`flex h-4 w-4 shrink-0 items-center justify-center border-2 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-ember-500 peer-focus-visible:ring-offset-2 ${
                        single ? "rounded-full" : "rounded-md"
                      } ${isPicked ? "border-ember-600 bg-ember-600 text-cream-50" : "border-charcoal-600/30 bg-cream-50"}`}
                    >
                      {isPicked &&
                        (single ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-cream-50" />
                        ) : (
                          <Check size={10} strokeWidth={4} />
                        ))}
                    </span>
                    <span className="min-w-0 flex-1 text-sm leading-snug text-ink">
                      {option.label}
                    </span>
                    <span
                      className={`shrink-0 text-[0.7rem] font-semibold tabular-nums ${
                        option.price > 0 ? "text-charcoal-600/80" : "text-ink/40"
                      }`}
                    >
                      {option.price > 0 ? `+ ${formatEuro(option.price)}` : t("free")}
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      {/* ---- the note for the kitchen -------------------------------- */}
      {orderable && (
        <div>
          {noteOpen || instructions ? (
            <div>
              <label htmlFor="instructions" className="block font-display text-base font-semibold text-charcoal-600">
                {t("instructions")}
              </label>
              <textarea
                id="instructions"
                rows={3}
                value={instructions}
                autoFocus={noteOpen && !instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={300}
                placeholder={t("instructionsPlaceholder")}
                className="mt-2.5 w-full rounded-2xl border-2 border-charcoal-600/10 bg-cream-50 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none"
              />
              <p className="mt-1 flex justify-between text-xs text-ink/50">
                <span>{t("instructionsHint")}</span>
                <span className="tabular-nums">{instructions.length}/300</span>
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-charcoal-600/20 px-4 py-2.5 text-sm font-semibold text-charcoal-600/80 transition-colors hover:border-ember-600/50 hover:text-ember-700"
            >
              <MessageSquarePlus size={16} aria-hidden="true" />
              {t("addNote")}
            </button>
          )}
        </div>
      )}

      {orderable && item.lowStock && (
        // Nearly gone: a nudge to be quick. Deliberately no number.
        <p className="flex items-center gap-2 rounded-2xl bg-ember-600/8 px-4 py-3 text-sm font-semibold text-ember-700">
          <Flame size={16} aria-hidden="true" />
          {tMenu("lowStockNote")}
        </p>
      )}

      {orderable ? (
        <div ref={mainButton} className="space-y-2.5">
          {/* One row from sm; on a phone the button gets a full-width row of its own,
              so its label and total never get squeezed. */}
          <div className="flex flex-wrap items-stretch gap-3 sm:flex-nowrap">
            <Stepper
              quantity={quantity}
              setQuantity={setQuantity}
              decrease={tCart("decrease")}
              increase={tCart("increase")}
              label={tCart("quantity")}
            />
            <AddButton
              onClick={handleAdd}
              justAdded={justAdded}
              blocked={missingRequired.length > 0}
              label={justAdded ? t("added") : t("addToCart")}
              total={formatEuro(total)}
            />
          </div>
          {missingRequired.length > 0 && (
            <p className="text-center text-xs text-ink/55 sm:text-left">{t("chooseFirst", { groups: missingNames })}</p>
          )}
        </div>
      ) : (
        <div className="rounded-3xl border border-charcoal-600/12 bg-cream-100 p-5">
          <p className="text-[0.95rem] text-ink/75">
            {item.soldOut
              ? t("soldOutNote")
              : item.price == null
                ? t("priceOnRequestNote")
                : t("closedNote")}
          </p>
          {/* A sold-out dish stays on the menu; trying to order it opens a polite
              message with a way to ask for it, instead of a dead button. */}
          {item.soldOut && item.price != null && (
            <button
              type="button"
              onClick={() => setRequestOpen(true)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ember-600 px-7 py-4 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 sm:w-auto"
            >
              <ShoppingBag size={18} />
              {tRequest("soldOutButton")}
            </button>
          )}
          {item.price == null && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-charcoal-600 px-6 py-3 font-display text-sm font-semibold text-cream-100 transition-colors hover:bg-ember-600"
            >
              {tMenu("orderViaWhatsapp")}
            </a>
          )}
        </div>
      )}

      {suggestOpen && <Suggestions basedOn={[item.slug]} variant="cards" />}

      {/* ---- the sticky bar on a phone --------------------------------- */}
      {orderable && (
        <div
          aria-hidden={!barVisible}
          className={`print:hidden fixed inset-x-0 bottom-[var(--dock-base,0px)] z-[44] px-3 pb-2 transition-[transform,opacity] duration-300 ease-brand md:hidden ${
            barVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
          }`}
        >
          <div className="mx-auto flex max-w-lg items-center gap-3 rounded-full bg-charcoal-800/95 p-1.5 pl-5 text-cream-50 shadow-2xl shadow-charcoal-950/40 backdrop-blur-lg">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs text-cream-200/70">
                {quantity > 1 ? `${quantity}× ` : ""}
                {item.name}
              </span>
              <span className="block font-display text-base font-bold tabular-nums">{formatEuro(total)}</span>
            </span>
            <button
              type="button"
              tabIndex={barVisible ? 0 : -1}
              onClick={handleAdd}
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ember-600 px-5 py-3 font-display text-sm font-semibold text-cream-50 transition-colors active:bg-ember-700"
            >
              {justAdded ? <Check size={17} /> : <ShoppingBag size={17} />}
              {missingRequired.length > 0 ? t("chooseShort") : justAdded ? t("addedShort") : t("addToCart")}
            </button>
          </div>
        </div>
      )}

      {requestOpen && (
        <StockRequestDialog
          slug={item.slug}
          name={item.name}
          open
          onClose={() => setRequestOpen(false)}
        />
      )}
    </div>
  );
}

function Stepper({
  quantity,
  setQuantity,
  decrease,
  increase,
  label,
}: {
  quantity: number;
  setQuantity: (fn: (q: number) => number) => void;
  decrease: string;
  increase: string;
  label: string;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-cream-100 p-1 ring-1 ring-charcoal-600/10">
      <button
        type="button"
        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
        disabled={quantity === 1}
        aria-label={decrease}
        className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-50 disabled:opacity-30 sm:h-11 sm:w-11"
      >
        <Minus size={17} />
      </button>
      <span
        aria-live="polite"
        aria-label={`${label}: ${quantity}`}
        className="w-7 text-center font-display text-lg font-bold tabular-nums text-charcoal-600"
      >
        {quantity}
      </span>
      <button
        type="button"
        onClick={() => setQuantity((q) => Math.min(50, q + 1))}
        aria-label={increase}
        className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-50 sm:h-11 sm:w-11"
      >
        <Plus size={17} />
      </button>
    </div>
  );
}

function AddButton({
  onClick,
  justAdded,
  blocked,
  label,
  total,
}: {
  onClick: () => void;
  justAdded: boolean;
  blocked: boolean;
  label: string;
  total: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative inline-flex min-w-0 basis-full items-center sm:flex-1 sm:basis-0 justify-between gap-3 overflow-hidden rounded-full px-4 py-3.5 font-display sm:px-6 text-sm font-semibold text-cream-50 shadow-lg transition-[background-color,translate,box-shadow] duration-300 hover:-translate-y-0.5 active:translate-y-0 ${
        justAdded
          ? "bg-success shadow-success/25"
          : blocked
            ? "bg-charcoal-600 shadow-charcoal-950/20"
            : "bg-ember-600 shadow-ember-800/30 hover:bg-ember-500"
      }`}
    >
      {/* A light sweep on hover. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 -skew-x-12 bg-cream-50/20 opacity-0 transition-[left,opacity] duration-700 ease-brand group-hover:left-[110%] group-hover:opacity-100"
      />
      <span className="flex min-w-0 items-center gap-2.5">
        {justAdded ? <Check size={18} className="shrink-0" /> : <ShoppingBag size={18} className="shrink-0" />}
        <span className="truncate">{label}</span>
      </span>
      <span className="shrink-0 rounded-full bg-cream-50/15 px-2.5 py-1 tabular-nums sm:px-3">{total}</span>
    </button>
  );
}
