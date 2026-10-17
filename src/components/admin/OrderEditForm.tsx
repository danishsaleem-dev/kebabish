"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Minus, Plus, Repeat, Trash2 } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { FormError, Select, SubmitButton, Textarea } from "@/components/admin/ui/Form";
import { saveOrderEditAction, type OrderEditState } from "@/app/admin/(dashboard)/orders/[id]/edit/actions";
import { formatMoney } from "@/lib/admin/units";
import type { EditableOrder } from "@/lib/admin/order-edit";

interface Dish {
  slug: string;
  name: string;
  price: number | null;
  soldOut: boolean;
  categoryId: string;
  optionGroupIds: string[];
}
interface Group {
  id: string;
  label: string;
  minChoices: number;
  maxChoices: number;
  options: { id: string; label: string; price: number }[];
}

/** One line of the order being edited. */
interface Line {
  key: number;
  /** "keep": an existing line (maybe with a new quantity/price). "menu": a dish picked from the menu. */
  mode: "keep" | "menu";
  from: number | null;
  slug: string;
  name: string;
  quantity: number;
  /** Extras of a kept line, as text. */
  extras: string[];
  /** For a menu line: the extras chosen, by group. */
  picked: Record<string, string[]>;
  instructions: string;
  /** What the customer is charged for one portion. `null` = follow the regular price. */
  price: string | null;
  /** For a kept line: what it is charged now, and its regular price if it is already a compensation. */
  originalCharged: number;
  originalRegular: number | null;
  /** The name of what this line replaces. */
  replaces: string | null;
}

const EMPTY: OrderEditState = { ok: false };

const euros = (cents: number) => cents / 100;
function parseEuros(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export default function OrderEditForm({
  order,
  categories,
  dishes,
  groups,
}: {
  order: EditableOrder;
  categories: { id: string; label: string }[];
  dishes: Dish[];
  groups: Group[];
}) {
  const [state, formAction] = useActionState(saveOrderEditAction, EMPTY);

  const dishBySlug = useMemo(() => new Map(dishes.map((d) => [d.slug, d])), [dishes]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  const [lines, setLines] = useState<Line[]>(() =>
    order.lines.map((l) => ({
      key: l.index,
      mode: "keep",
      from: l.index,
      slug: l.slug,
      name: l.name,
      quantity: l.quantity,
      extras: l.extras,
      picked: {},
      instructions: l.instructions,
      price: null,
      originalCharged: euros(l.chargedCents),
      originalRegular: l.listUnitPriceCents != null ? euros(l.listUnitPriceCents) : null,
      replaces: l.replaces,
    }))
  );
  const [nextKey, setNextKey] = useState(order.lines.length);
  const [discount, setDiscount] = useState(euros(order.discountCents).toFixed(2));
  const [fee, setFee] = useState(euros(order.deliveryFeeCents).toFixed(2));
  const [replacing, setReplacing] = useState<number | null>(null);

  const patch = (key: number, change: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)));

  /** A menu dish's regular price for one portion, with the extras picked. */
  const regularOf = (line: Line): number | null => {
    if (line.mode === "keep") return line.originalRegular;
    const dish = dishBySlug.get(line.slug);
    if (!dish || dish.price == null) return null;
    const extras = Object.entries(line.picked).reduce((sum, [gid, ids]) => {
      const group = groupById.get(gid);
      return sum + ids.reduce((s, id) => s + (group?.options.find((o) => o.id === id)?.price ?? 0), 0);
    }, 0);
    return dish.price + extras;
  };

  /** What is charged for one portion: what staff typed, else the regular price, else what it was. */
  const chargedOf = (line: Line): number => {
    const typed = line.price === null ? null : parseEuros(line.price);
    if (typed !== null) return typed;
    if (line.mode === "keep") return line.originalCharged;
    return regularOf(line) ?? 0;
  };

  const subtotal = lines.reduce((n, l) => n + chargedOf(l) * l.quantity, 0);
  const discountValue = Math.min(parseEuros(discount) ?? 0, subtotal);
  const feeValue = parseEuros(fee) ?? 0;
  const total = Math.max(subtotal - discountValue + feeValue, 0);

  const settled = order.paymentStatus === "paid" || order.paymentStatus === "refunded";
  const netPaid = euros(Math.max(order.totalCents - order.refundedCents, 0));
  const difference = total - netPaid;

  const payload = JSON.stringify(
    lines.map((l) => ({
      mode: l.mode,
      from: l.from,
      slug: l.mode === "menu" ? l.slug : null,
      quantity: l.quantity,
      priceCents: Math.round(chargedOf(l) * 100),
      options: Object.entries(l.picked).flatMap(([groupId, ids]) => ids.map((optionId) => ({ groupId, optionId }))),
      instructions: l.instructions,
      replaces: l.replaces,
    }))
  );

  function togglePick(line: Line, group: Group, optionId: string) {
    const current = line.picked[group.id] ?? [];
    let next: string[];
    if (group.maxChoices === 1) next = [optionId];
    else if (current.includes(optionId)) next = current.filter((id) => id !== optionId);
    else next = current.length >= group.maxChoices ? current : [...current, optionId];
    patch(line.key, { picked: { ...line.picked, [group.id]: next } });
  }

  /** Swap a line for another dish: it keeps the price the customer was paying. */
  function replaceWith(line: Line, slug: string) {
    if (!slug) return;
    const dish = dishBySlug.get(slug);
    if (!dish) return;
    patch(line.key, {
      mode: "menu",
      slug,
      name: dish.name,
      picked: {},
      extras: [],
      instructions: "",
      // The customer keeps paying what they were paying; the dish's regular price is shown
      // beside it, and anything it is worth above that is the compensation.
      price: chargedOf(line).toFixed(2),
      replaces: line.replaces ?? line.name,
      originalRegular: null,
    });
    setReplacing(null);
  }

  function addDish(slug: string) {
    const dish = dishBySlug.get(slug);
    if (!dish) return;
    setLines((prev) => [
      ...prev,
      {
        key: nextKey,
        mode: "menu",
        from: null,
        slug,
        name: dish.name,
        quantity: 1,
        extras: [],
        picked: {},
        instructions: "",
        price: null,
        originalCharged: 0,
        originalRegular: null,
        replaces: null,
      },
    ]);
    setNextKey((k) => k + 1);
  }

  const missingChoice = (line: Line) =>
    line.mode === "menu" &&
    (dishBySlug.get(line.slug)?.optionGroupIds ?? []).some((gid) => {
      const group = groupById.get(gid);
      return group && group.minChoices > 0 && (line.picked[gid]?.length ?? 0) < group.minChoices;
    });

  const dishOptions = (
    <>
      {categories.map((c) => {
        const inCategory = dishes.filter((d) => d.categoryId === c.id);
        if (inCategory.length === 0) return null;
        return (
          <optgroup key={c.id} label={c.label}>
            {inCategory.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
                {d.price != null ? ` — ${formatMoney(d.price)}` : ""}
                {d.soldOut ? " (sold out)" : ""}
              </option>
            ))}
          </optgroup>
        );
      })}
    </>
  );

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="orderId" value={order.id} />
      <input type="hidden" name="lines" value={payload} />

      <div className="min-w-0 space-y-5">
        <FormError message={state.error} />

        <Card>
          <CardHeader
            title="What the customer gets"
            subtitle="Set what each portion is charged. A dish worth more than the price is shown on the bill with its regular price."
          />

          <ul className="mt-4 space-y-3">
            {lines.map((line) => {
              const regular = regularOf(line);
              const charged = chargedOf(line);
              const compensation = regular != null && regular > charged ? (regular - charged) * line.quantity : 0;
              const dish = line.mode === "menu" ? dishBySlug.get(line.slug) : undefined;

              return (
                <li key={line.key} className="rounded-xl border border-hairline p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-heading">{line.name}</p>
                      {line.extras.length > 0 && <p className="text-xs text-muted">{line.extras.join(", ")}</p>}
                      {line.replaces && (
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted">
                          <Repeat size={12} /> replaces {line.replaces}
                        </p>
                      )}
                      {dish?.soldOut && <p className="mt-0.5 text-xs font-medium text-warn">Marked sold out on the menu</p>}
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        type="button"
                        aria-label="One less"
                        onClick={() => patch(line.key, { quantity: Math.max(1, line.quantity - 1) })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline hover:bg-canvas"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="w-8 text-center text-sm font-semibold tabular-nums">{line.quantity}</span>
                      <button
                        type="button"
                        aria-label="One more"
                        onClick={() => patch(line.key, { quantity: Math.min(50, line.quantity + 1) })}
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline hover:bg-canvas"
                      >
                        <Plus size={14} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                        className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:text-danger"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>

                  {line.mode === "menu" &&
                    (dish?.optionGroupIds ?? []).map((gid) => {
                      const group = groupById.get(gid);
                      if (!group) return null;
                      return (
                        <fieldset key={gid} className="mt-3">
                          <legend className="text-xs font-semibold text-heading">
                            {group.label}
                            <span className="ml-1 font-normal text-muted">
                              {group.minChoices > 0 ? `(choose ${group.minChoices})` : "(optional)"}
                            </span>
                          </legend>
                          <div className="mt-1.5 flex flex-wrap gap-2">
                            {group.options.map((option) => {
                              const on = (line.picked[gid] ?? []).includes(option.id);
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => togglePick(line, group, option.id)}
                                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                                    on
                                      ? "border-ember-600 bg-ember-600/10 text-ember-700"
                                      : "border-hairline text-body-text hover:bg-canvas"
                                  }`}
                                >
                                  {option.label}
                                  {option.price > 0 && ` +${formatMoney(option.price)}`}
                                </button>
                              );
                            })}
                          </div>
                        </fieldset>
                      );
                    })}

                  {line.mode === "menu" && (
                    <input
                      value={line.instructions}
                      onChange={(ev) => patch(line.key, { instructions: ev.target.value })}
                      placeholder="Note for this dish (optional)"
                      maxLength={300}
                      className="mt-3 h-9 w-full rounded-lg border border-hairline bg-panel px-3 text-sm focus:border-ember-500 focus:outline-none"
                    />
                  )}

                  <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                    <label className="flex items-center gap-2 text-xs text-muted">
                      Charge € each
                      <input
                        inputMode="decimal"
                        aria-label={`Price for one ${line.name}`}
                        value={line.price ?? charged.toFixed(2)}
                        onChange={(ev) => patch(line.key, { price: ev.target.value })}
                        className={`h-8 w-24 rounded-lg border px-2 text-sm font-semibold tabular-nums text-heading focus:border-ember-500 focus:outline-none ${
                          line.price !== null ? "border-ember-600 bg-ember-600/5" : "border-hairline bg-panel"
                        }`}
                      />
                    </label>

                    {regular != null && (
                      <span className={`text-xs ${compensation > 0 ? "font-medium text-ember-700" : "text-muted"}`}>
                        Regular price {formatMoney(regular)}
                        {compensation > 0 && ` — compensation ${formatMoney(compensation)}`}
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => setReplacing(replacing === line.key ? null : line.key)}
                      className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-hairline px-3 py-1.5 text-xs font-semibold text-body-text hover:bg-canvas"
                    >
                      <Repeat size={13} />
                      Swap for another dish
                    </button>
                  </div>

                  {replacing === line.key && (
                    <div className="mt-3">
                      <Select value="" onChange={(ev) => replaceWith(line, ev.target.value)} aria-label="Swap for">
                        <option value="">Choose the dish to send instead…</option>
                        {dishOptions}
                      </Select>
                      <p className="mt-1.5 text-xs text-muted">
                        The customer keeps paying {formatMoney(charged)} each. If the new dish costs more, the
                        difference is shown on the bill as a compensation.
                      </p>
                    </div>
                  )}

                  {missingChoice(line) && (
                    <p className="mt-2 text-xs font-medium text-warn">This dish has a choice you haven&apos;t made (optional here).</p>
                  )}
                </li>
              );
            })}
          </ul>

          <div className="mt-4">
            <Select value="" onChange={(ev) => addDish(ev.target.value)} aria-label="Add a dish">
              <option value="">+ Add a dish…</option>
              {dishOptions}
            </Select>
          </div>
        </Card>

        <Card>
          <CardHeader title="Why was it changed?" subtitle="Kept in the order's history. Only staff see it." />
          <div className="mt-3">
            <Textarea name="note" rows={2} maxLength={500} placeholder="e.g. Chicken Biryani sold out — agreed on the phone to send Boneless Biryani for the same price" />
          </div>
        </Card>
      </div>

      <aside className="space-y-5">
        {order.invoiced && (
          <Card className="border-warn/30 bg-warn-soft">
            <p className="flex items-start gap-2 text-sm text-warn">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" />
              <span>
                An invoice was already issued for this order. It is built from the order, so the PDF will show the
                changed lines under the same number — the copy that was emailed earlier stays as it was.
              </span>
            </p>
          </Card>
        )}

        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Dishes</dt>
              <dd className="font-semibold tabular-nums text-heading">{formatMoney(subtotal)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Discount €</dt>
              <dd>
                <input
                  name="discount"
                  inputMode="decimal"
                  value={discount}
                  onChange={(ev) => setDiscount(ev.target.value)}
                  aria-label="Discount"
                  className="h-9 w-24 rounded-lg border border-hairline bg-panel px-2 text-right text-sm font-semibold tabular-nums focus:border-ember-500 focus:outline-none"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Delivery fee €</dt>
              <dd>
                <input
                  name="deliveryFee"
                  inputMode="decimal"
                  value={fee}
                  onChange={(ev) => setFee(ev.target.value)}
                  aria-label="Delivery fee"
                  className="h-9 w-24 rounded-lg border border-hairline bg-panel px-2 text-right text-sm font-semibold tabular-nums focus:border-ember-500 focus:outline-none"
                />
              </dd>
            </div>
            <div className="flex items-center justify-between border-t border-hairline pt-2">
              <dt className="font-semibold text-heading">New total</dt>
              <dd className="font-display text-lg font-semibold tabular-nums text-heading">{formatMoney(total)}</dd>
            </div>
            <div className="flex items-center justify-between text-xs text-muted">
              <dt>Was</dt>
              <dd className="tabular-nums">{formatMoney(euros(order.totalCents))}</dd>
            </div>
          </dl>

          {settled && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs font-medium ${
                Math.abs(difference) < 0.005 ? "bg-success-soft text-success" : "bg-warn-soft text-warn"
              }`}
            >
              {Math.abs(difference) < 0.005
                ? `The customer has paid ${formatMoney(netPaid)} — nothing to settle.`
                : difference > 0
                  ? `The customer has paid ${formatMoney(netPaid)}: ${formatMoney(difference)} is still to collect.`
                  : `The customer has paid ${formatMoney(netPaid)}: ${formatMoney(-difference)} goes back to them — use Refund on the order page after saving.`}
            </p>
          )}
          {!settled && order.paymentStatus === "open" && (
            <p className="mt-3 rounded-lg bg-canvas px-3 py-2 text-xs text-muted">
              Not paid yet — the customer pays the new total.
            </p>
          )}

          <div className="mt-4 space-y-2">
            <SubmitButton>Save changes</SubmitButton>
            <Link
              href={`/admin/orders/${order.id}`}
              className="block rounded-lg border border-hairline px-4 py-2.5 text-center text-sm font-semibold text-body-text hover:bg-canvas"
            >
              Cancel
            </Link>
          </div>
        </Card>
      </aside>
    </form>
  );
}
