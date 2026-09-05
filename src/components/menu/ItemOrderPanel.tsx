"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus, ShoppingBag, Check } from "lucide-react";
import { useCart, type CartOption } from "@/components/cart/CartProvider";
import { formatEuro } from "@/lib/money";
import type { PublicMenuItem } from "@/lib/public-menu";

/**
 * Extras, instructions, quantity, add-to-cart.
 *
 * A dish with no price can't be added: the cart would carry a line it
 * can't total and checkout would be impossible. Those fall back to the
 * WhatsApp path, which is how they're ordered today anyway.
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
  const { add, openDrawer } = useCart();

  const [selected, setSelected] = useState<Record<string, string[]>>({});
  const [instructions, setInstructions] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

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

  const missingRequired = item.optionGroups.filter(
    (g) => (selected[g.id]?.length ?? 0) < g.minChoices
  );

  function toggle(groupId: string, optionId: string, max: number) {
    setJustAdded(false);
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
    if (!orderable || missingRequired.length > 0) return;
    add(
      {
        slug: item.slug,
        name: item.name,
        unitPrice: item.price ?? 0,
        options: chosen,
        instructions: instructions.trim(),
      },
      quantity
    );
    setJustAdded(true);
    openDrawer();
  }

  return (
    <div className="space-y-8">
      {item.optionGroups.map((group) => {
        const picked = selected[group.id] ?? [];
        const single = group.maxChoices === 1;
        const rule =
          group.minChoices > 0
            ? group.minChoices === group.maxChoices
              ? t("chooseExactly", { min: group.minChoices })
              : t("chooseAtLeast", { min: group.minChoices })
            : single
              ? t("optional")
              : t("chooseUpTo", { max: group.maxChoices });

        return (
          <fieldset key={group.id}>
            <legend className="flex flex-wrap items-baseline gap-x-3">
              <span className="font-display text-lg font-semibold text-charcoal-600">
                {group.label}
              </span>
              <span className="text-sm text-ink/55">{rule}</span>
            </legend>

            <div className="mt-3 space-y-2">
              {group.options.map((option) => {
                const isPicked = picked.includes(option.id);
                const atLimit = !single && picked.length >= group.maxChoices;

                return (
                  <label
                    key={option.id}
                    className={`flex cursor-pointer items-center justify-between gap-3 rounded-2xl border px-4 py-3 transition-colors duration-200 ${
                      isPicked
                        ? "border-ember-600 bg-ember-600/5"
                        : "border-charcoal-600/15 bg-cream-50 hover:border-charcoal-600/30"
                    } ${atLimit && !isPicked ? "opacity-45" : ""}`}
                  >
                    <span className="flex items-center gap-3">
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={group.id}
                        checked={isPicked}
                        disabled={atLimit && !isPicked}
                        onChange={() =>
                          toggle(group.id, option.id, group.maxChoices)
                        }
                        className="h-4 w-4 accent-ember-600"
                      />
                      <span className="text-[0.95rem] text-ink">
                        {option.label}
                      </span>
                    </span>
                    {option.price > 0 && (
                      <span className="shrink-0 text-sm font-semibold text-charcoal-600/80">
                        + {formatEuro(option.price)}
                      </span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}

      <div>
        <label
          htmlFor="instructions"
          className="block font-display text-lg font-semibold text-charcoal-600"
        >
          {t("instructions")}
        </label>
        <textarea
          id="instructions"
          rows={3}
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          maxLength={300}
          placeholder={t("instructionsPlaceholder")}
          className="mt-3 w-full rounded-2xl border border-charcoal-600/15 bg-cream-50 px-4 py-3 text-[0.95rem] text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none"
        />
        <p className="mt-1.5 text-sm text-ink/50">{t("instructionsHint")}</p>
      </div>

      {orderable ? (
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-full border border-charcoal-600/20 p-1">
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              disabled={quantity === 1}
              aria-label={tCart("decrease")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-100 disabled:opacity-35"
            >
              <Minus size={16} />
            </button>
            <span
              aria-label={tCart("quantity")}
              className="w-8 text-center font-display text-base font-semibold text-charcoal-600"
            >
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => setQuantity((q) => Math.min(50, q + 1))}
              aria-label={tCart("increase")}
              className="flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-100"
            >
              <Plus size={16} />
            </button>
          </div>

          <button
            type="button"
            onClick={handleAdd}
            disabled={missingRequired.length > 0}
            className="inline-flex flex-1 items-center justify-center gap-2.5 rounded-full bg-ember-600 px-7 py-4 font-display text-sm font-semibold text-cream-50 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 disabled:translate-y-0 disabled:opacity-45 sm:flex-none"
          >
            {justAdded ? <Check size={18} /> : <ShoppingBag size={18} />}
            {justAdded ? t("added") : t("addToCart")}
            <span className="tabular-nums">
              · {formatEuro(unitTotal * quantity)}
            </span>
          </button>
        </div>
      ) : (
        <div className="rounded-2xl border border-charcoal-600/15 bg-cream-100 p-5">
          <p className="text-[0.95rem] text-ink/75">
            {item.soldOut
              ? t("soldOutNote")
              : item.price == null
                ? t("priceOnRequestNote")
                : t("closedNote")}
          </p>
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
    </div>
  );
}
