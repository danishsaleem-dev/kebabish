"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check, MessageSquarePlus, RotateCcw, ShoppingBag, X } from "lucide-react";
import { useCart, type CartOption } from "@/components/cart/CartProvider";
import { AddButton, Stepper } from "@/components/menu/ItemOrderPanel";
import { REMOVED, dealLineName, dealLineSlug, evaluateDeal, type DealPicks } from "@/lib/deals";
import { formatEuro, fromCents, toCents } from "@/lib/money";
import type { PublicDeal, PublicDealSlot } from "@/lib/public-deals";

/** The first dish that can be served, or out of the deal if none can and that's allowed. */
function startingPick(slot: PublicDealSlot): string {
  const available = slot.choices.find((c) => !c.soldOut);
  if (available) return available.slug;
  return slot.removable ? REMOVED : (slot.choices[0]?.slug ?? REMOVED);
}

/**
 * The deal page's buy box: what's in the deal, a choice where there is one, and a remove button on
 * each part that can go. The price and the saving update as the customer changes it, with the same
 * `evaluateDeal` the server prices with. The server still re-checks everything when paying.
 */
export default function DealBuilder({ deal, isOpen }: { deal: PublicDeal; isOpen: boolean }) {
  const t = useTranslations("deals");
  const tItem = useTranslations("item");
  const tCart = useTranslations("cart");
  const { add, openDrawer } = useCart();

  const [picks, setPicks] = useState<DealPicks>(() =>
    Object.fromEntries(deal.slots.map((s) => [s.id, startingPick(s)]))
  );
  const [quantity, setQuantity] = useState(1);
  const [instructions, setInstructions] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [justAdded, setJustAdded] = useState(false);
  const mainButton = useRef<HTMLDivElement>(null);
  const [barVisible, setBarVisible] = useState(false);

  const priceOf = (slug: string) => {
    const choice = deal.slots.flatMap((s) => s.choices).find((c) => c.slug === slug);
    return choice ? toCents(choice.price) : null;
  };
  const result = evaluateDeal(deal, picks, priceOf);
  const kept = deal.slots.filter((s) => picks[s.id] !== REMOVED).length;
  const canRemoveMore = kept > deal.minItems;
  const hasSoldOutPick = deal.slots.some((s) => s.choices.find((c) => c.slug === picks[s.id])?.soldOut);
  const orderable = isOpen && !deal.soldOut && result.ok && !hasSoldOutPick;

  const unit = result.ok ? fromCents(result.unitCents) : deal.price;
  const worth = result.ok ? fromCents(result.listCents) : deal.wasPrice;
  const saving = Math.max(worth - unit, 0);
  const total = unit * quantity;

  // The sticky bar on a phone, the same as on a dish page.
  useEffect(() => {
    const el = mainButton.current;
    if (!el || !orderable) return;
    const observer = new IntersectionObserver(([entry]) => setBarVisible(!entry.isIntersecting));
    observer.observe(el);
    return () => {
      observer.disconnect();
      setBarVisible(false);
    };
  }, [orderable]);

  useEffect(() => {
    const root = document.documentElement;
    if (barVisible) root.setAttribute("data-addbar", "");
    else root.removeAttribute("data-addbar");
    return () => root.removeAttribute("data-addbar");
  }, [barVisible]);

  function setPick(slotId: string, value: string) {
    setJustAdded(false);
    setPicks((prev) => ({ ...prev, [slotId]: value }));
  }

  function handleAdd() {
    if (!orderable) return;
    const options = deal.slots.map((slot): CartOption => {
      const pick = picks[slot.id];
      const choice = slot.choices.find((c) => c.slug === pick);
      const fallback = slot.choices.map((c) => c.name).join(" / ");
      return {
        groupId: slot.id,
        groupLabel: "Deal",
        optionId: pick,
        optionLabel: choice
          ? slot.quantity > 1
            ? `${slot.quantity} × ${choice.name}`
            : choice.name
          : t("without", { name: fallback }),
        price: choice ? 0 : -slot.removeCredit,
      };
    });
    add(
      {
        slug: dealLineSlug(deal.slug),
        name: dealLineName(deal.name),
        image: deal.image,
        unitPrice: deal.price,
        options,
        instructions: instructions.trim(),
      },
      quantity
    );
    setJustAdded(true);
    openDrawer();
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-lg font-semibold text-charcoal-600">{t("included")}</h2>
        <ul className="mt-3 space-y-3">
          {deal.slots.map((slot) => {
            const pick = picks[slot.id];
            const removed = pick === REMOVED;
            const current = slot.choices.find((c) => c.slug === pick);
            const removeLocked = !removed && !canRemoveMore;

            return (
              <li
                key={slot.id}
                className={`rounded-2xl border-2 p-3 transition-colors ${
                  removed ? "border-dashed border-charcoal-600/15 bg-transparent" : "border-charcoal-600/10 bg-cream-50"
                }`}
              >
                {slot.label && !removed && (
                  <p className="mb-2 font-display text-sm font-semibold text-charcoal-600">{slot.label}</p>
                )}

                {removed ? (
                  <div className="flex items-center justify-between gap-3">
                    <p className="min-w-0 text-sm text-ink/55">
                      <s>{slot.choices.map((c) => c.name).join(" / ")}</s>
                      <span className="ml-2 font-semibold tabular-nums text-success">
                        − {formatEuro(slot.removeCredit)}
                      </span>
                    </p>
                    {slot.choices.some((c) => !c.soldOut) && (
                      <button
                        type="button"
                        onClick={() => setPick(slot.id, startingPick({ ...slot, removable: false }))}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-ember-700 transition-colors hover:bg-ember-600/10"
                      >
                        <RotateCcw size={14} aria-hidden="true" />
                        {t("putBack")}
                      </button>
                    )}
                  </div>
                ) : slot.choices.length > 1 ? (
                  <div role="radiogroup" aria-label={slot.label} className="grid gap-2 min-[420px]:grid-cols-2">
                    {slot.choices.map((choice) => {
                      const active = choice.slug === pick;
                      return (
                        <label
                          key={choice.slug}
                          className={`flex items-center gap-2.5 rounded-xl border-2 p-2 transition-colors ${
                            choice.soldOut ? "cursor-not-allowed opacity-50" : "cursor-pointer"
                          } ${active ? "border-ember-600 bg-ember-600/[0.06]" : "border-charcoal-600/10 hover:border-charcoal-600/25"}`}
                        >
                          <input
                            type="radio"
                            name={slot.id}
                            checked={active}
                            disabled={choice.soldOut}
                            onChange={() => setPick(slot.id, choice.slug)}
                            className="sr-only"
                          />
                          <Thumb src={choice.image} />
                          <span className="min-w-0 flex-1 text-sm leading-snug text-ink">
                            {slot.quantity > 1 ? `${slot.quantity} × ` : ""}
                            {choice.name}
                            {choice.soldOut && <span className="block text-xs text-ink/55">{t("choiceSoldOut")}</span>}
                          </span>
                          {active && <Check size={16} aria-hidden="true" className="shrink-0 text-ember-600" />}
                        </label>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <Thumb src={current?.image} />
                    <p className="min-w-0 flex-1 text-[0.95rem] font-medium leading-snug text-charcoal-600">
                      {slot.quantity > 1 ? `${slot.quantity} × ` : ""}
                      {current?.name}
                      {current?.portion && <span className="block text-xs font-normal text-ink/55">{current.portion}</span>}
                      {current?.soldOut && <span className="block text-xs font-normal text-red-700">{t("choiceSoldOut")}</span>}
                    </p>
                  </div>
                )}

                {slot.removable && !removed && (
                  <button
                    type="button"
                    disabled={removeLocked}
                    onClick={() => setPick(slot.id, REMOVED)}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-sm font-semibold text-ink/60 transition-colors hover:text-red-700 disabled:opacity-40 disabled:hover:text-ink/60"
                  >
                    <X size={14} aria-hidden="true" />
                    {t("remove", { amount: formatEuro(slot.removeCredit) })}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        {!canRemoveMore && deal.slots.some((s) => s.removable) && (
          <p className="mt-2 text-xs text-ink/55">{t("minItems", { count: deal.minItems })}</p>
        )}
      </div>

      <dl className="rounded-2xl bg-charcoal-800 p-4 text-cream-100">
        {worth > unit && (
          <div className="flex justify-between text-sm text-cream-200/75">
            <dt>{t("separately")}</dt>
            <dd className="tabular-nums line-through">{formatEuro(worth)}</dd>
          </div>
        )}
        <div className="mt-1 flex items-baseline justify-between font-display">
          <dt className="text-base font-semibold">{t("youPay")}</dt>
          <dd className="text-3xl font-bold tabular-nums text-cream-50">{formatEuro(unit)}</dd>
        </div>
        {saving > 0 && (
          <p className="mt-1 text-right text-sm font-semibold text-ember-400">
            {t("youSave", { amount: formatEuro(saving) })}
          </p>
        )}
      </dl>

      {orderable ? (
        <>
          {noteOpen || instructions ? (
            <div>
              <label htmlFor="deal-instructions" className="block font-display text-base font-semibold text-charcoal-600">
                {tItem("instructions")}
              </label>
              <textarea
                id="deal-instructions"
                rows={3}
                value={instructions}
                autoFocus={noteOpen && !instructions}
                onChange={(e) => setInstructions(e.target.value)}
                maxLength={300}
                placeholder={tItem("instructionsPlaceholder")}
                className="mt-2 w-full rounded-2xl border-2 border-charcoal-600/10 bg-cream-50 px-4 py-3 text-base text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none"
              />
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setNoteOpen(true)}
              className="inline-flex items-center gap-2 rounded-full border-2 border-dashed border-charcoal-600/20 px-4 py-2.5 text-sm font-semibold text-charcoal-600/80 transition-colors hover:border-ember-600/50 hover:text-ember-700"
            >
              <MessageSquarePlus size={16} aria-hidden="true" />
              {tItem("addNote")}
            </button>
          )}

          <div ref={mainButton} className="flex flex-wrap items-stretch gap-3 sm:flex-nowrap">
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
              blocked={false}
              label={justAdded ? tItem("added") : tItem("addToCart")}
              total={formatEuro(total)}
            />
          </div>

          <div
            aria-hidden={!barVisible}
            className={`print:hidden fixed inset-x-0 bottom-[var(--dock-base,0px)] z-[44] px-3 pb-2 transition-[transform,opacity] duration-300 ease-brand md:hidden ${
              barVisible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
            }`}
          >
            <div className="mx-auto flex max-w-lg items-center gap-3 rounded-full bg-charcoal-800/95 p-1.5 pl-5 text-cream-50 shadow-2xl shadow-charcoal-950/40 backdrop-blur-lg">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-cream-200/70">{deal.name}</span>
                <span className="block font-display text-base font-bold tabular-nums">{formatEuro(total)}</span>
              </span>
              <button
                type="button"
                tabIndex={barVisible ? 0 : -1}
                onClick={handleAdd}
                className="inline-flex shrink-0 items-center gap-2 rounded-full bg-ember-600 px-5 py-3 font-display text-sm font-semibold text-cream-50 transition-colors active:bg-ember-700"
              >
                {justAdded ? <Check size={17} /> : <ShoppingBag size={17} />}
                {justAdded ? tItem("addedShort") : tItem("addToCart")}
              </button>
            </div>
          </div>
        </>
      ) : (
        <p className="rounded-2xl border border-charcoal-600/12 bg-cream-100 p-4 text-[0.95rem] text-ink/75">
          {!isOpen ? tItem("closedNote") : t("unavailableNote")}
        </p>
      )}
    </div>
  );
}

function Thumb({ src }: { src?: string }) {
  return (
    <span className="relative block h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-cream-300">
      {src && <Image src={src} alt="" fill sizes="48px" className="object-cover" />}
    </span>
  );
}
