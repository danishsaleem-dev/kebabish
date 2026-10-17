"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, Check, Minus, Plus, X } from "lucide-react";
import { requestDishAction, type RequestDishState } from "@/app/[locale]/(site)/menu/request-actions";
import Suggestions from "@/components/menu/Suggestions";

const EMPTY: RequestDishState = { ok: false };

/** Amsterdam's calendar day, "YYYY-MM-DD" — the earliest day a request can ask for. */
function amsterdamToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * What a customer sees when they try to order a dish that is sold out: a polite
 * message instead of a dead button, a short form to ask for it (how many, and when),
 * and — so the visit isn't wasted — a row of other dishes they can add right away.
 * Sending it saves a request for the kitchen and emails them; nothing is reserved
 * or charged, and the dialog says so.
 *
 * A modal like the promotion popup: Escape and the backdrop close it, focus stays inside,
 * the page behind doesn't scroll.
 */
export default function StockRequestDialog({
  slug,
  name,
  open,
  onClose,
}: {
  slug: string;
  name: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("stockRequest");
  const tSuggest = useTranslations("suggestions");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState(requestDishAction, EMPTY);
  const [quantity, setQuantity] = useState(1);
  const [customer, setCustomer] = useState({ name: "", phone: "" });
  const dialogRef = useRef<HTMLDivElement>(null);
  const e = state.errors ?? {};
  const done = state.ok;

  useEffect(() => {
    if (!open) return;

    const returnTo = document.activeElement as HTMLElement | null;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        onClose();
        return;
      }
      if (ev.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        "button:not(:disabled), a[href], input:not(:disabled), textarea, select"
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (ev.shiftKey && document.activeElement === first) {
        ev.preventDefault();
        last.focus();
      } else if (!ev.shiftKey && document.activeElement === last) {
        ev.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);

    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("[data-autofocus]")?.focus();

    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
      returnTo?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  const fieldError = (key: string) =>
    e[key] ? (
      <span className="mt-1 block text-xs font-medium text-red-700">{t(`errors.${e[key]}`)}</span>
    ) : null;
  const input =
    "h-12 w-full rounded-2xl border border-charcoal-600/15 bg-cream-50 px-4 text-[0.95rem] text-ink placeholder:text-ink/35 focus:border-ember-600 focus:outline-none";
  const label = "mb-1.5 block text-sm font-medium text-charcoal-600/80";
  const optional = <span className="font-normal text-ink/45"> ({t("optional")})</span>;

  return (
    <div
      data-lenis-prevent
      className="fixed inset-0 z-[90] flex items-end justify-center overflow-y-auto bg-charcoal-950/65 p-0 backdrop-blur-[3px] animate-[media-fade-in_0.25s_ease-out_both] motion-reduce:animate-none sm:items-center sm:p-4"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stock-request-title"
        className="relative my-auto w-full max-w-lg rounded-t-3xl bg-cream-50 p-5 shadow-2xl sm:rounded-3xl sm:p-7"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="absolute right-3 top-3 flex h-10 w-10 items-center justify-center rounded-full text-charcoal-600 transition-colors hover:bg-cream-200"
        >
          <X size={20} />
        </button>

        {done ? (
          <div className="text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-ember-600 text-cream-50">
              <Check size={28} strokeWidth={3} />
            </span>
            <h2 id="stock-request-title" className="mt-4 font-display text-2xl font-semibold text-charcoal-600">
              {t("successTitle")}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-pretty text-sm text-ink/70">
              {t("successText", { name: customer.name.trim().split(/\s+/)[0] ?? "", phone: customer.phone })}
            </p>
            <button
              type="button"
              data-autofocus
              onClick={onClose}
              className="mt-6 w-full rounded-full bg-ember-600 px-6 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              {t("close")}
            </button>
          </div>
        ) : (
          <form action={formAction}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="locale" value={locale} />
            {/* Honeypot: people never see this; form-filling bots do. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="absolute -left-[9999px] h-0 w-0 opacity-0"
            />

            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ember-600/10 text-ember-700">
              <CalendarClock size={22} />
            </span>
            <h2
              id="stock-request-title"
              className="mt-3 pr-8 font-display text-xl font-semibold leading-snug text-charcoal-600 sm:text-2xl"
            >
              {t("title", { name })}
            </h2>
            <p className="mt-2 text-pretty text-sm leading-relaxed text-ink/70">{t("intro")}</p>

            {state.error && (
              <p role="alert" className="mt-4 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
                {t(`errors.${state.error}`)}
              </p>
            )}

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div>
                <span className={label}>{t("quantity")}</span>
                <div className="flex h-12 items-center justify-between rounded-2xl border border-charcoal-600/15 bg-cream-50 px-1.5">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    disabled={quantity <= 1}
                    aria-label="−"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal-600 hover:bg-cream-200 disabled:opacity-35"
                  >
                    <Minus size={16} />
                  </button>
                  <input
                    name="quantity"
                    type="number"
                    min={1}
                    max={100}
                    inputMode="numeric"
                    value={quantity}
                    onChange={(ev) => setQuantity(Math.min(100, Math.max(1, Number(ev.target.value) || 1)))}
                    aria-label={t("quantity")}
                    className="w-14 bg-transparent text-center font-display text-lg font-semibold text-charcoal-600 focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                  />
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(100, q + 1))}
                    aria-label="+"
                    className="flex h-9 w-9 items-center justify-center rounded-full text-charcoal-600 hover:bg-cream-200"
                  >
                    <Plus size={16} />
                  </button>
                </div>
                {fieldError("quantity")}
              </div>

              <div className="grid grid-cols-2 gap-3 sm:col-span-1">
                <label className="block">
                  <span className={label}>
                    {t("date")}
                    {optional}
                  </span>
                  <input name="date" type="date" min={amsterdamToday()} className={input} />
                  {fieldError("date")}
                </label>
                <label className="block">
                  <span className={label}>
                    {t("time")}
                    {optional}
                  </span>
                  <input name="time" type="time" step={900} className={input} />
                  {fieldError("time")}
                </label>
              </div>

              <label className="block">
                <span className={label}>{t("name")}</span>
                <input
                  name="name"
                  required
                  autoComplete="name"
                  data-autofocus
                  value={customer.name}
                  onChange={(ev) => setCustomer((c) => ({ ...c, name: ev.target.value }))}
                  className={input}
                />
                {fieldError("name")}
              </label>
              <label className="block">
                <span className={label}>{t("phone")}</span>
                <input
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="06 12345678"
                  value={customer.phone}
                  onChange={(ev) => setCustomer((c) => ({ ...c, phone: ev.target.value }))}
                  className={input}
                />
                {fieldError("phone")}
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>
                  {t("email")}
                  {optional}
                </span>
                <input name="email" type="email" autoComplete="email" className={input} />
                {fieldError("email")}
              </label>
              <label className="block sm:col-span-2">
                <span className={label}>
                  {t("note")}
                  {optional}
                </span>
                <textarea name="note" rows={2} maxLength={500} className={`${input} h-auto py-3`} />
              </label>
            </div>

            <button
              type="submit"
              disabled={pending}
              className="mt-5 w-full rounded-full bg-ember-600 px-6 py-4 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500 disabled:opacity-60"
            >
              {pending ? t("sending") : t("submit")}
            </button>
            <p className="mt-2 text-center text-xs text-ink/55">{t("noCharge")}</p>
          </form>
        )}

        {/* So the visit isn't a dead end: other dishes that can be ordered right now. */}
        <div className="mt-6 border-t border-charcoal-600/10 pt-5">
          <Suggestions basedOn={[slug]} variant="scroll" limit={4} title={tSuggest("alternativesTitle")} />
        </div>
      </div>
    </div>
  );
}
