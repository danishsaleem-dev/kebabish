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
import PostcodeField, { type ResolvedAddress } from "@/components/cart/PostcodeField";
import CustomerPicker from "@/components/admin/CustomerPicker";
import type { CustomerOption } from "@/lib/admin/orders-data";
import {
  checkManualPromoAction,
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
  /** The price staff typed for one portion (extras included), or null to use the menu price. */
  price: string | null;
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

/** "12,5" / "12.50" -> 12.5, or null when it isn't a usable amount. */
function parseEuros(text: string): number | null {
  const t = text.trim().replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Today in Amsterdam, "YYYY-MM-DD" — the day a "past" order is measured against. */
function amsterdamToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function ManualOrderForm({
  categories,
  dishes,
  groups,
  deliveryFee,
  freeDeliveryOver,
  customers,
}: {
  /** Returning customers staff can pick instead of typing everything again. */
  customers: CustomerOption[];
  categories: { id: string; label: string }[];
  dishes: ManualMenuDish[];
  groups: ManualMenuGroup[];
  /** The shop's delivery fee and the order value above which it is free (from Settings). */
  deliveryFee: number;
  freeDeliveryOver: number | null;
}) {
  const [state, formAction] = useActionState(createManualOrderAction, EMPTY);
  const e = state.errors ?? {};

  const [lines, setLines] = useState<Line[]>([]);
  const [nextKey, setNextKey] = useState(1);
  const [channel, setChannel] = useState("phone");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  // The customer fields are controlled so picking a returning customer can fill them in.
  const [picked, setPicked] = useState<CustomerOption | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [houseNumber, setHouseNumber] = useState("");
  const [addition, setAddition] = useState("");
  // Changing `n` remounts the postcode box, which is how a picked address is pushed into it.
  const [postcodeSeed, setPostcodeSeed] = useState<{ n: number; initial?: ResolvedAddress }>({ n: 0 });
  const [date, setDate] = useState("");
  const [slots, setSlots] = useState<SlotOption[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [email, setEmail] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [promo, setPromo] = useState<{ ok: boolean; discount?: number; message?: string } | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [feeText, setFeeText] = useState("");
  const [discountText, setDiscountText] = useState("");

  function pickCustomer(c: CustomerOption) {
    setPicked(c);
    setCustomerName(c.name);
    setPhone(c.phone);
    setEmail(c.email);
    setHouseNumber(c.houseNumber);
    setAddition(c.addition);
    setStreet(c.street);
    setCity(c.city);
    setPostcodeSeed((s) => ({
      n: s.n + 1,
      initial: c.postcode ? { street: c.street, postcode: c.postcode, city: c.city } : undefined,
    }));
  }

  const dishBySlug = useMemo(() => new Map(dishes.map((d) => [d.slug, d])), [dishes]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);

  // Slot availability for the chosen day — the same public endpoint the
  // customer checkout polls. Only open slots can be picked.
  const isPast = Boolean(date) && date < amsterdamToday();
  useEffect(() => {
    if (!date || isPast) {
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
  }, [date, isPast]);

  /** What the menu says one portion costs, extras included. */
  const menuPrice = (line: Line) => {
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
  /** What it will be charged at: the price staff typed, if they did, else the menu's. */
  const unitPrice = (line: Line) => {
    const typed = line.price === null ? null : parseEuros(line.price);
    return typed ?? menuPrice(line);
  };
  const subtotal = lines.reduce((sum, l) => sum + unitPrice(l) * l.quantity, 0);

  // The delivery fee as it will be charged: what staff typed, else the shop's rule.
  const autoFee = freeDeliveryOver != null && subtotal >= freeDeliveryOver ? 0 : deliveryFee;
  const typedFee = parseEuros(feeText);
  const fee = typedFee ?? autoFee;
  const couponDiscount = promo?.ok ? (promo.discount ?? 0) : 0;
  // The discount typed by hand comes off on top of any coupon, never past the dishes' total.
  const adminDiscount = Math.min(parseEuros(discountText) ?? 0, Math.max(subtotal - couponDiscount, 0));
  const total = Math.max(subtotal - couponDiscount - adminDiscount + fee, 0);

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
      // Only where staff changed it; otherwise the server uses the menu's price.
      ...(l.price !== null && parseEuros(l.price) !== null ? { price: parseEuros(l.price) } : {}),
    }))
  );

  async function checkPromo() {
    setPromoChecking(true);
    try {
      setPromo(await checkManualPromoAction(cartPayload, promoCode, email, date));
    } catch {
      setPromo({ ok: false, message: "Couldn't check the code — try again." });
    } finally {
      setPromoChecking(false);
    }
  }

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
          <CardHeader title="Dishes" subtitle="Prices start from the menu. Change a price to what you agreed with the customer." />
          <div className="mt-4">
            <Select
              value=""
              onChange={(ev) => {
                const slug = ev.target.value;
                if (!slug) return;
                setLines((prev) => [
                  ...prev,
                  { key: nextKey, slug, quantity: 1, instructions: "", picked: {}, price: null },
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
                        <label className="mt-1.5 flex items-center gap-2 text-xs text-muted">
                          Price each €
                          <input
                            inputMode="decimal"
                            aria-label={`Price for one ${dish.name}`}
                            value={line.price ?? menuPrice(line).toFixed(2)}
                            onChange={(ev) => patch(line.key, { price: ev.target.value })}
                            className={`h-8 w-24 rounded-lg border px-2 text-sm font-semibold tabular-nums text-heading focus:border-ember-500 focus:outline-none ${
                              line.price !== null ? "border-ember-600 bg-ember-600/5" : "border-hairline bg-panel"
                            }`}
                          />
                          {line.price !== null && (
                            <button
                              type="button"
                              onClick={() => patch(line.key, { price: null })}
                              className="font-semibold text-ember-700 hover:underline"
                            >
                              Use menu price ({formatMoney(menuPrice(line))})
                            </button>
                          )}
                        </label>
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
            <div className="sm:col-span-2">
              <input type="hidden" name="customerId" value={picked?.customerId ?? ""} />
              <CustomerPicker
                customers={customers}
                selected={picked}
                onPick={pickCustomer}
                onClear={() => setPicked(null)}
              />
            </div>
            <Field label="Name" error={e.customerName}>
              <Input
                name="customerName"
                autoComplete="off"
                required
                value={customerName}
                onChange={(ev) => setCustomerName(ev.target.value)}
                invalid={Boolean(e.customerName)}
              />
            </Field>
            <Field label="Phone" error={e.phone}>
              <Input
                name="phone"
                type="tel"
                autoComplete="off"
                required
                value={phone}
                onChange={(ev) => setPhone(ev.target.value)}
                invalid={Boolean(e.phone)}
              />
            </Field>
            <Field
              label="Email"
              hint="Optional. With one, they get the order emails and receipt."
              error={e.email}

            >
              <Input
                name="email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                invalid={Boolean(e.email)}
              />
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
                key={postcodeSeed.n}
                initial={postcodeSeed.initial}
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
                <Input
                  name="houseNumber"
                  required
                  value={houseNumber}
                  onChange={(ev) => setHouseNumber(ev.target.value)}
                  invalid={Boolean(e.houseNumber)}
                />
              </Field>
              <Field label="Addition" error={e.addition}>
                <Input name="addition" value={addition} onChange={(ev) => setAddition(ev.target.value)} />
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
            title="Date & time"
            subtitle="Pick the day from the calendar — a day that has already passed is fine, for an order you are entering afterwards."
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

            {!isPast ? (
              <Field
                label="Slot"
                error={e.slot}
                hint={date && !slotsLoading && slots.length === 0 ? "Closed that day — no slots." : undefined}
              >
                <Select name="slot" defaultValue="" disabled={!date || slotsLoading} invalid={Boolean(e.slot)}>
                  <option value="">No set slot</option>
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
            ) : (
              <div className="hidden sm:block" />
            )}

            <Field
              label={isPast ? "Time" : "Or an exact time"}
              hint={
                isPast
                  ? "When the order was placed and delivered."
                  : "Optional. Used when no slot is picked above."
              }
              error={e.deliveryTime}
            >
              <Input name="deliveryTime" type="time" step={300} invalid={Boolean(e.deliveryTime)} />
            </Field>
          </div>

          {isPast && (
            <div className="mt-4 space-y-2 rounded-lg bg-canvas p-3">
              <p className="text-xs text-muted">
                This day has passed, so the order is saved under that date and time (in the order list and
                reports). No slot is booked and the customer is not emailed.
              </p>
              <Checkbox name="alreadyDelivered" label="It was already delivered" defaultChecked />
            </div>
          )}
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
          {e.payment && <p className="mt-2 text-xs font-medium text-danger">{e.payment}</p>}
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
          <CardHeader title="Coupon" subtitle="Optional. Checked against the basket and the customer's email." />
          <div className="mt-3 flex gap-2">
            <Input
              name="promoCode"
              value={promoCode}
              onChange={(ev) => {
                setPromoCode(ev.target.value.toUpperCase());
                setPromo(null);
              }}
              placeholder="WELKOM10"
              autoComplete="off"
              invalid={Boolean(e.promoCode)}
            />
            <button
              type="button"
              onClick={checkPromo}
              disabled={promoChecking || !promoCode.trim() || lines.length === 0}
              className="shrink-0 rounded-lg border border-hairline px-4 text-sm font-semibold text-body-text hover:bg-canvas disabled:opacity-50"
            >
              {promoChecking ? "…" : "Check"}
            </button>
          </div>
          {e.promoCode && <p className="mt-2 text-xs font-medium text-danger">{e.promoCode}</p>}
          {promo && (
            <p className={`mt-2 text-xs font-medium ${promo.ok ? "text-success" : "text-danger"}`}>
              {promo.ok ? `Takes ${formatMoney(promo.discount ?? 0)} off.` : promo.message}
            </p>
          )}
        </Card>

        <Card>
          <dl className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Dishes</dt>
              <dd className="font-semibold tabular-nums text-heading">{formatMoney(subtotal)}</dd>
            </div>
            {couponDiscount > 0 && (
              <div className="flex items-center justify-between">
                <dt className="text-muted">Coupon</dt>
                <dd className="font-semibold tabular-nums text-success">−{formatMoney(couponDiscount)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Discount €</dt>
              <dd>
                <input
                  name="adminDiscount"
                  inputMode="decimal"
                  value={discountText}
                  onChange={(ev) => setDiscountText(ev.target.value)}
                  placeholder="0.00"
                  aria-label="Discount in euros"
                  className={`h-9 w-24 rounded-lg border px-2 text-right text-sm font-semibold tabular-nums focus:border-ember-500 focus:outline-none ${
                    discountText.trim() !== "" ? "border-ember-600 bg-ember-600/5" : "border-hairline bg-panel"
                  }`}
                />
              </dd>
            </div>
            {e.adminDiscount && <p className="text-xs font-medium text-danger">{e.adminDiscount}</p>}
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Delivery fee €</dt>
              <dd>
                <input
                  name="deliveryFee"
                  inputMode="decimal"
                  value={feeText}
                  onChange={(ev) => setFeeText(ev.target.value)}
                  placeholder={autoFee.toFixed(2)}
                  aria-label="Delivery fee"
                  className={`h-9 w-24 rounded-lg border px-2 text-right text-sm font-semibold tabular-nums focus:border-ember-500 focus:outline-none ${
                    feeText.trim() !== "" ? "border-ember-600 bg-ember-600/5" : "border-hairline bg-panel"
                  }`}
                />
              </dd>
            </div>
            {e.deliveryFee && <p className="text-xs font-medium text-danger">{e.deliveryFee}</p>}
            <div className="flex items-center justify-between border-t border-hairline pt-2">
              <dt className="font-semibold text-heading">Total</dt>
              <dd className="font-display text-lg font-semibold tabular-nums text-heading">{formatMoney(total)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-muted">
            Leave the delivery fee empty for the usual one from your settings, or type 0 for free delivery.
          </p>
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
