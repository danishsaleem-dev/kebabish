"use client";

import { useActionState, useMemo, useState } from "react";
import { AlertTriangle, Plus, Sparkles, Trash2, X } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { Checkbox, Field, FormError, Input, Select, SubmitButton, Textarea } from "@/components/admin/ui/Form";
import ImageField from "@/components/admin/media/ImageField";
import { dealProblems, dealWasCents, suggestedCredits } from "@/lib/deals";
import { isSellablePrice, toCents } from "@/lib/money";
import { formatMoney } from "@/lib/admin/units";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredDeal, StoredMedia } from "@/lib/admin/store/types";

export interface DealDish {
  slug: string;
  name: string;
  price: number | null;
  category: string;
}

interface SlotDraft {
  id: string;
  label: string;
  labelEn: string;
  quantity: number;
  itemSlugs: string[];
  removable: boolean;
  removeCredit: string;
}

const newSlot = (): SlotDraft => ({
  id: `p-${Math.random().toString(36).slice(2, 9)}`,
  label: "",
  labelEn: "",
  quantity: 1,
  itemSlugs: [],
  removable: false,
  removeCredit: "0",
});

/**
 * Create or edit a deal. The parts live in React state and submit as one JSON field, for the same
 * reason as the extras form: parallel inputs zipped by position are how the opening-hours bug
 * happened. The price summary and warnings run the same `lib/deals.ts` the server checks with.
 */
export default function DealForm({
  deal,
  dishes,
  library,
  action,
  submitLabel,
}: {
  deal?: StoredDeal;
  dishes: DealDish[];
  library: StoredMedia[];
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  const [price, setPrice] = useState(deal ? String(deal.price) : "");
  const [minItems, setMinItems] = useState(String(deal?.minItems ?? 1));
  const [slots, setSlots] = useState<SlotDraft[]>(
    deal?.slots.length
      ? deal.slots.map((s) => ({
          id: s.id,
          label: s.label ?? "",
          labelEn: s.labelEn ?? "",
          quantity: s.quantity,
          itemSlugs: s.itemSlugs,
          removable: s.removable,
          removeCredit: String(s.removeCredit),
        }))
      : [newSlot()]
  );

  const update = (id: string, patch: Partial<SlotDraft>) =>
    setSlots((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const byCategory = useMemo(() => {
    const groups = new Map<string, DealDish[]>();
    for (const dish of dishes) groups.set(dish.category, [...(groups.get(dish.category) ?? []), dish]);
    return [...groups.entries()];
  }, [dishes]);

  const priceOf = (slug: string) => {
    const value = dishes.find((d) => d.slug === slug)?.price;
    return isSellablePrice(value) ? toCents(value) : null;
  };
  const nameOf = (slug: string) => dishes.find((d) => d.slug === slug)?.name ?? slug;

  const filled = slots.filter((s) => s.itemSlugs.length > 0);
  const draft: StoredDeal = {
    slug: "",
    createdAt: "",
    name: "",
    description: "",
    price: Number(price) || 0,
    minItems: Number(minItems) || 1,
    visible: true,
    slots: filled.map((s) => ({ ...s, removeCredit: s.removable ? Number(s.removeCredit) || 0 : 0 })),
  };

  const was = dealWasCents(draft, priceOf) / 100;
  const saving = was - draft.price;
  const problems = dealProblems(draft, priceOf, nameOf);
  const canCheck = draft.price > 0 && filled.length > 0;

  function suggest() {
    const credits = suggestedCredits(draft, priceOf);
    setSlots((prev) =>
      prev.map((s) => (s.removable && credits[s.id] != null ? { ...s, removeCredit: String(credits[s.id]) } : s))
    );
  }

  return (
    <form action={formAction} className="grid gap-4 sm:gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
      {deal && <input type="hidden" name="slug" value={deal.slug} />}
      <input type="hidden" name="slots" value={JSON.stringify(draft.slots)} />

      <div className="min-w-0 space-y-4 sm:space-y-6">
        <Card>
          <CardHeader title={deal ? `Edit “${deal.name}”` : "New deal"} />
          <div className="mt-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Name (Dutch)" error={state.errors?.name}>
                <Input name="name" defaultValue={deal?.name} placeholder="Familie Deal" invalid={Boolean(state.errors?.name)} />
              </Field>
              <Field label="Name (English)" hint="Leave empty to use the Dutch name." error={state.errors?.nameEn}>
                <Input name="nameEn" defaultValue={deal?.nameEn} placeholder="Family Deal" />
              </Field>
            </div>
            <Field label="Description (Dutch)" error={state.errors?.description}>
              <Textarea name="description" rows={3} defaultValue={deal?.description} />
            </Field>
            <Field label="Description (English)" hint="Leave empty to use the Dutch text." error={state.errors?.descriptionEn}>
              <Textarea name="descriptionEn" rows={3} defaultValue={deal?.descriptionEn} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <CardHeader
              title="What's in the deal"
              subtitle="Each part is one dish, or a choice of several (a drink, a sauce). Add a second dish to a part and the customer chooses."
            />
            <button
              type="button"
              onClick={() => setSlots((prev) => [...prev, newSlot()])}
              className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-heading transition-colors hover:border-ember-500 hover:text-ember-600"
            >
              <Plus size={14} />
              Add part
            </button>
          </div>

          <ul className="mt-4 space-y-3">
            {slots.map((slot, index) => (
              <li key={slot.id} className="rounded-xl border border-hairline p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-heading">Part {index + 1}</p>
                  <button
                    type="button"
                    onClick={() => setSlots((prev) => prev.filter((s) => s.id !== slot.id))}
                    disabled={slots.length === 1}
                    aria-label={`Remove part ${index + 1}`}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-danger disabled:opacity-30"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {slot.itemSlugs.length > 0 && (
                  <ul className="mt-2 flex flex-wrap gap-1.5">
                    {slot.itemSlugs.map((slug) => (
                      <li
                        key={slug}
                        className="inline-flex items-center gap-1.5 rounded-full bg-canvas py-1 pl-3 pr-1 text-sm text-heading"
                      >
                        {nameOf(slug)}
                        <span className="text-xs tabular-nums text-muted">
                          {priceOf(slug) != null ? formatMoney(priceOf(slug)! / 100) : "no price"}
                        </span>
                        <button
                          type="button"
                          onClick={() => update(slot.id, { itemSlugs: slot.itemSlugs.filter((s) => s !== slug) })}
                          aria-label={`Remove ${nameOf(slug)}`}
                          className="flex h-6 w-6 items-center justify-center rounded-full text-faint hover:text-danger"
                        >
                          <X size={13} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_6rem]">
                  <Field label={slot.itemSlugs.length ? "Add a choice" : "Dish"}>
                    <Select
                      value=""
                      onChange={(e) => {
                        const slug = e.target.value;
                        if (slug && !slot.itemSlugs.includes(slug)) {
                          update(slot.id, { itemSlugs: [...slot.itemSlugs, slug] });
                        }
                      }}
                    >
                      <option value="">Pick a dish…</option>
                      {byCategory.map(([category, list]) => (
                        <optgroup key={category} label={category}>
                          {list.map((dish) => (
                            <option key={dish.slug} value={dish.slug}>
                              {dish.name}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Portions">
                    <Input
                      type="number"
                      min={1}
                      max={20}
                      value={slot.quantity}
                      onChange={(e) => update(slot.id, { quantity: Math.max(1, Number(e.target.value) || 1) })}
                    />
                  </Field>
                </div>

                {slot.itemSlugs.length > 1 && (
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    <Field label="Choice heading (Dutch)">
                      <Input
                        value={slot.label}
                        onChange={(e) => update(slot.id, { label: e.target.value })}
                        placeholder="Kies je drankje"
                      />
                    </Field>
                    <Field label="Choice heading (English)">
                      <Input
                        value={slot.labelEn}
                        onChange={(e) => update(slot.id, { labelEn: e.target.value })}
                        placeholder="Choose your drink"
                      />
                    </Field>
                  </div>
                )}

                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_9rem] sm:items-end">
                  <Checkbox
                    label="The customer can remove this"
                    checked={slot.removable}
                    onChange={(e) => update(slot.id, { removable: e.target.checked })}
                  />
                  {slot.removable && (
                    <Field label="Takes off (€)">
                      <Input
                        type="number"
                        min={0}
                        step="0.05"
                        value={slot.removeCredit}
                        onChange={(e) => update(slot.id, { removeCredit: e.target.value })}
                      />
                    </Field>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <aside className="space-y-4 sm:space-y-6 lg:sticky lg:top-24">
        <Card>
          <CardHeader title="Price" />
          <div className="mt-4 space-y-4">
            <Field label="Deal price (€)" error={state.errors?.price}>
              <Input
                name="price"
                type="number"
                min={0}
                step="0.05"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                invalid={Boolean(state.errors?.price)}
              />
            </Field>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Bought separately</dt>
                <dd className="tabular-nums text-heading">{formatMoney(was)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Customer saves</dt>
                <dd className={`font-semibold tabular-nums ${saving > 0 ? "text-success" : "text-warn"}`}>
                  {formatMoney(Math.max(saving, 0))}
                  {was > 0 && saving > 0 ? ` (${Math.round((saving / was) * 100)}%)` : ""}
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-relaxed text-muted">
              The separate price comes from the menu, with the cheapest dish in each choice. It
              follows your dish prices, so it is shown crossed out on the site.
            </p>
            <Field label="Parts that must stay" hint="1 = the customer can remove everything removable but one part." error={state.errors?.minItems}>
              <Input
                name="minItems"
                type="number"
                min={1}
                max={20}
                value={minItems}
                onChange={(e) => setMinItems(e.target.value)}
              />
            </Field>
            {slots.some((s) => s.removable) && (
              <button
                type="button"
                onClick={suggest}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-heading transition-colors hover:border-ember-500 hover:text-ember-600"
              >
                <Sparkles size={14} />
                Suggest amounts to take off
              </button>
            )}
          </div>
        </Card>

        {canCheck && problems.errors.length + problems.warnings.length > 0 && (
          <Card>
            <ul className="space-y-2 text-sm">
              {problems.errors.map((text) => (
                <li key={text} className="flex gap-2 text-danger">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  {text}
                </li>
              ))}
              {problems.warnings.map((text) => (
                <li key={text} className="flex gap-2 text-warn">
                  <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                  {text}
                </li>
              ))}
            </ul>
          </Card>
        )}

        <Card>
          <div className="space-y-3">
            <ImageField
              library={library}
              initialId={deal?.imageId}
              label="Photo"
              hint="Without one, the page shows the photos of the dishes inside."
            />
            <Checkbox label="Show on the website" name="visible" defaultChecked={deal?.visible ?? true} />
            <Checkbox label="Feature first" name="featured" defaultChecked={deal?.featured ?? false} />
          </div>
        </Card>

        <FormError message={state.message} />
        <div className="flex justify-end">
          <SubmitButton>{submitLabel}</SubmitButton>
        </div>
      </aside>
    </form>
  );
}
