"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, Copy, Minus, Plus, Trash2 } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import {
  Checkbox,
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
  Textarea,
} from "@/components/admin/ui/Form";
import PostcodeField from "@/components/cart/PostcodeField";
import {
  createManualOrderAction,
  type ManualOrderState,
} from "@/app/admin/(dashboard)/orders/create/actions";
import { formatMoney } from "@/lib/admin/units";

export interface ManualMenuDish {
  slug: string;
  name: string;
  price: number;
  categoryId: string;
  optionGroupIds: string[];
}
export interface ManualMenuGroup {
  id: string;
  label: string;
  minChoices: number;
  maxChoices: number;
  options: { id: string; label: string; price: number }[];
}

interface Line {
  key: number;
  slug: string;
  quantity: number;
  instructions: string;
  /** Chosen option ids per group id. */
  picked: Record<string, string[]>;
}

interface SlotOption {
  start: string;
  end: string;
  status: "available" | "full" | "disabled" | "past";
}

const EMPTY: ManualOrderState = { ok: false };

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash on delivery", hint: "The rider collects it. Mark it paid on the order when it's handed over." },
  { value: "paid_cash", label: "Already paid in cash", hint: "Settled now — goes straight to the kitchen as paid." },
  { value: "bank_transfer", label: "Bank transfer (awaiting)", hint: "Mark it paid on the order once the transfer arrives." },
  { value: "paid_bank", label: "Already paid by bank transfer", hint: "Settled now." },
  { value: "unpaid", label: "Pay later", hint: "No payment yet — settle it from the order page." },
  { value: "mollie_link", label: "Send an online payment link", hint: "You get a link to send the customer. The kitchen sees the order once they've paid." },
] as const;

export default function ManualOrderForm({
  categories,
  dishes,
  groups,
}: {
  categories: { id: string; label: string }[];
  dishes: ManualMenuDish[];
  groups: ManualMenuGroup[];
}) {
  const [state, formAction] = useActionState(createManualOrderAction, EMPTY);
  const e = state.errors ?? {};

  const [lines, setLines] = useState<Line[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [channel, setChannel] = useState("phone");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const dishBySlug = useMemo(() => new Map(dishes.map((d) => [d.slug, d])), [dishes]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // Slot availability for the chosen day — the same public endpoint the
  // customer checkout polls. Only open slots can be picked.
  useEffect(() => {
    if (!date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    fetch(`/api/delivery-slots?date=${date}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { slots: [] }))
      .then((data) => !cancelled && setSlots(data.slots ?? []))
      .catch(() => !cancelled && setSlots([]))
      .finally(() => !cancelled && setSlotsLoading(false));
    return () => {
      cancelled = true;
    };
  }, [date]);

  const unitPrice = (line: Line) => {
    const dish = dishBySlug.get(line.slug);
    if (!dish) return 0;
    const extras = Object.entries(line.picked).reduce((sum, [groupId, ids]) => {
      const group = groupById.get(groupId);
      return (
        sum +
        ids.reduce((s, id) => s + (group?.options.find((o) => o.id === id)?.price ?? 0), 0)
      );
    }, 0);
    return dish.price + extras;
  };
  const subtotal = lines.reduce((sum, l) => sum + unitPrice(l) * l.quantity, 0);

  /** Is every required extras group filled in for this line? */
  const missingChoice = (line: Line) =>
    (dishBySlug.get(line.slug)?.optionGroupIds ?? []).some((gid) => {
      const group = groupById.get(gid);
      return group && group.minChoices > 0 && (line.picked[gid]?.length ?? 0) < group.minChoices;
    });
  const incomplete = lines.some(missingChoice);

  const cartPayload = JSON.stringify(
    lines.map((l) => ({
      slug: l.slug,
      quantity: l.quantity,
      instructions: l.instructions,
      options: Object.entries(l.picked).flatMap(([groupId, ids]) =>
        ids.map((optionId) => ({ groupId, optionId }))
      ),
    }))
  );

  const patch = (key: number, change: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...change } : l)));

  function togglePick(line: Line, group: ManualMenuGroup, optionId: string) {
    const current = line.picked[group.id] ?? [];
    let next: string[];
    if (group.maxChoices === 1) next = [optionId];
    else if (current.includes(optionId)) next = current.filter((id) => id !== optionId);
    else next = current.length >= group.maxChoices ? current : [...current, optionId];
    patch(line.key, { picked: { ...line.picked, [group.id]: next } });
  }

  // The order exists and needs a payment link handed to the customer.
  if (state.created) {
    const { created } = state;
    return (
      <Card className="mx-auto max-w-xl space-y-4 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-success-soft text-success">
          <Check size={22} />
        </span>
        <h2 className="font-display text-xl font-semibold text-heading">
          Order {created.reference} created
        </h2>
        <p className="text-sm text-muted">
          Send the customer this link to pay. It works for about 15 minutes; the kitchen sees the
          order as soon as it's paid.
        </p>
        <div className="flex items-center gap-2 rounded-lg border border-hairline bg-canvas p-2 text-left">
          <input
            readOnly
            value={created.paymentLink}
            onFocus={(ev) => ev.currentTarget.select()}
            className="min-w-0 flex-1 bg-transparent px-2 text-xs text-body-text focus:outline-none"
          />
          <button
            type="button"
            onClick={() => {
              navigator.clipboard?.writeText(created.paymentLink).then(() => setCopied(true));
            }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-ember-600 px-3 py-2 text-xs font-semibold text-white hover:bg-ember-500"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          <Link
            href={`/admin/orders/${created.id}`}
            className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text hover:bg-canvas"
          >
            View the order
          </Link>
          <Link
            href="/admin/orders/create"
            onClick={() => window.location.assign("/admin/orders/create")}
            className="rounded-lg border border-hairline px-4 py-2.5 text-sm font-semibold text-body-text hover:bg-canvas"
          >
            Create another
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <form action={formAction} className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <input type="hidden" name="cart" value={cartPayload} />

      <div className="min-w-0 space-y-5">
        <FormError message={state.error} />

        {/* ---- dishes ---------------------------------------------------- */}
        <Card>
          <CardHeader title="Dishes" subtitle="Prices come from the menu — they can't be changed here." />
          <div className="mt-4">
            <Select
              value=""
              onChange={(ev) => {
                const slug = ev.target.value;
                if (!slug) return;
                setLines((prev) => [
                  ...prev,
                  { key: nextKey, slug, quantity: 1, instructions: "", picked: {} },
                ]);
                setNextKey((k) => k + 1);
              }}
              aria-label="Add a dish"
            >
              <option value="">+ Add a dish…</option>
              {categories.map((c) => {
                const inCategory = dishes.filter((d) => d.categoryId === c.id);
                if (inCategory.length === 0) return null;
                return (
                  <optgroup key={c.id} label={c.label}>
                    {inCategory.map((d) => (
                      <option key={d.slug} value={d.slug}>
                        {d.name} — {formatMoney(d.price)}
                      </option>
                    ))}
                  </optgroup>
                );
              })}
            </Select>
          </div>

          {lines.length > 0 && (
            <ul className="mt-4 space-y-3">
              {lines.map((line) => {
                const dish = dishBySlug.get(line.slug);
                if (!dish) return null;
                return (
                  <li key={line.key} className="rounded-xl border border-hairline p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-heading">{dish.name}</p>
                        <p className="text-xs text-muted">{formatMoney(unitPrice(line))} each</p>
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
                        <span className="w-8 text-center text-sm font-semibold tabular-nums">
                          {line.quantity}
                        </span>
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
                          aria-label={`Remove ${dish.name}`}
                          onClick={() => setLines((prev) => prev.filter((l) => l.key !== line.key))}
                          className="ml-1 flex h-8 w-8 items-center justify-center rounded-lg text-faint hover:text-danger"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {dish.optionGroupIds.map((gid) => {
                      const group = groupById.get(gid);
                      if (!group) return null;
                      return (
                        <fieldset key={gid} className="mt-3">
                          <legend className="text-xs font-semibold text-heading">
                            {group.label}
                            <span className="ml-1 font-normal text-muted">
                              {group.minChoices > 0
                                ? `(choose ${group.minChoices === group.maxChoices ? group.minChoices : `${group.minChoices}–${group.maxChoices}`})`
                                : group.maxChoices === 1
                                  ? "(optional)"
                                  : `(optional, up to ${group.maxChoices})`}
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

                    <input
                      value={line.instructions}
                      onChange={(ev) => patch(line.key, { instructions: ev.target.value })}
                      placeholder="Note for this dish (optional)"
                      maxLength={300}
                      className="mt-3 h-9 w-full rounded-lg border border-hairline bg-panel px-3 text-sm focus:border-ember-500 focus:outline-none"
                    />
                    {missingChoice(line) && (
                      <p className="mt-2 text-xs font-medium text-danger">Pick the required choice above.</p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* ---- customer -------------------------------------------------- */}
        <Card>
          <CardHeader title="Customer" />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name" error={e.customerName}>
              <Input name="customerName" autoComplete="off" required invalid={Boolean(e.customerName)} />
            </Field>
            <Field label="Phone" error={e.phone}>
              <Input name="phone" type="tel" autoComplete="off" required invalid={Boolean(e.phone)} />
            </Field>
            <Field
              label="Email"
              hint="Optional. With one, they get the order emails and receipt."
              error={e.email}

            >
              <Input name="email" type="email" autoComplete="off" invalid={Boolean(e.email)} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Delivery address"
            subtitle="Type the postcode to look the street and town up — or fill them in by hand."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Postcode" error={e.postcode} >
              <PostcodeField
                name="postcode"
                required
                placeholder="1616RK"
                onResolved={({ street: s, city: c }) => {
                  setStreet(s);
                  setCity(c);
                }}
              />
            </Field>
            <Field label="Town" error={e.city}>
              <Input
                name="city"
                value={city}
                onChange={(ev) => setCity(ev.target.value)}
                required
                invalid={Boolean(e.city)}
              />
            </Field>
            <Field label="Street" error={e.street}>
              <Input
                name="street"
                value={street}
                onChange={(ev) => setStreet(ev.target.value)}
                required
                invalid={Boolean(e.street)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="House no." error={e.houseNumber}>
                <Input name="houseNumber" required invalid={Boolean(e.houseNumber)} />
              </Field>
              <Field label="Addition" error={e.addition}>
                <Input name="addition" />
              </Field>
            </div>
          </div>
          <div className="mt-4">
            <Field label="Note for the order" hint="Door code, allergies… shown to the kitchen and rider." error={e.notes}>
              <Textarea name="notes" rows={2} maxLength={500} />
            </Field>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Delivery time"
            subtitle="Optional. Leave the slot empty for an order with no set time."
          />
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Date" error={e.deliveryDate}>
              <Input
                name="deliveryDate"
                type="date"
                value={date}
                onChange={(ev) => setDate(ev.target.value)}
                invalid={Boolean(e.deliveryDate)}
              />
            </Field>
            <Field
              label="Slot"
              error={e.slot}
              hint={date && !slotsLoading && slots.length === 0 ? "Closed that day — no slots." : undefined}
            >
              <Select name="slot" defaultValue="" disabled={!date || slotsLoading} invalid={Boolean(e.slot)}>
                <option value="">No set time</option>
                {slots.map((s) => (
                  <option
                    key={s.start}
                    value={`${s.start}|${s.end}`}
                    disabled={s.status !== "available"}
                  >
                    {s.start}–{s.end}
                    {s.status === "full" ? " (full)" : s.status === "disabled" ? " (off)" : s.status === "past" ? " (past)" : ""}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
        </Card>
      </div>

      {/* ---- sidebar ---------------------------------------------------- */}
      <aside className="space-y-5">
        <Card>
          <CardHeader title="Where did it come from?" />
          <div className="mt-4 space-y-3">
            <Select name="channel" value={channel} onChange={(ev) => setChannel(ev.target.value)}>
              <option value="phone">Phone</option>
              <option value="whatsapp">WhatsApp</option>
              <option value="website">Website</option>
              <option value="other">Other</option>
            </Select>
            {channel === "other" && (
              <Field label="Where from?" error={e.channelNote}>
                <Input name="channelNote" maxLength={50} placeholder="e.g. walked in, Instagram" />
              </Field>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Payment" />
          <div className="mt-4 space-y-2">
            {PAYMENT_OPTIONS.map((option, i) => (
              <label
                key={option.value}
                className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-hairline p-3 has-[:checked]:border-ember-600 has-[:checked]:bg-ember-600/5"
              >
                <input
                  type="radio"
                  name="payment"
                  value={option.value}
                  defaultChecked={i === 0}
                  className="mt-0.5 h-4 w-4 accent-ember-600"
                />
                <span className="text-sm text-body-text">
                  <span className="font-medium text-heading">{option.label}</span>
                  <span className="block text-xs text-muted">{option.hint}</span>
                </span>
              </label>
            ))}
          </div>
        </Card>

        <Card>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Dishes</span>
            <span className="font-semibold tabular-nums text-heading">{formatMoney(subtotal)}</span>
          </div>
          <p className="mt-1 text-xs text-muted">
            The delivery fee is added when you save, from your settings.
          </p>
          <div className="mt-3">
            <Checkbox name="waiveDelivery" label="Waive the delivery fee" />
          </div>
          <div className="mt-4">
            <SubmitButton>Create order</SubmitButton>
          </div>
          {lines.length === 0 && (
            <p className="mt-2 text-xs text-muted">Add at least one dish first.</p>
          )}
          {incomplete && (
            <p className="mt-2 text-xs text-danger">A dish is missing a required choice.</p>
          )}
        </Card>
      </aside>
    </form>
  );
}
