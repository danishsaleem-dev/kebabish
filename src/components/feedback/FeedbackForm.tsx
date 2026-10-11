"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { submitFeedbackAction } from "@/app/[locale]/(site)/feedback/actions";
import {
  COMMENT_MAX,
  HAPPY_AT_OR_ABOVE,
  HEARD_FROM_OPTIONS,
  ORDERED_BEFORE_OPTIONS,
  RECOMMEND_ID,
  SCALE_VALUES,
  questionsFor,
  type FeedbackPayload,
  type FeedbackSection,
} from "@/lib/feedback/questions";

type Step = "intro" | "order" | FeedbackSection | "finish";

export interface FeedbackFormProps {
  locale: string;
  /** Where this visit came from (already whitelisted by the page). */
  source: string;
  /** Present when the visitor opened the form from an order link. */
  order: {
    reference: string;
    token: string;
    name: string;
    email: string;
    dishes: { slug: string; name: string }[];
  } | null;
  /** The live menu, for picking dishes when there is no order to read them from. */
  menu: { id: string; label: string; items: { slug: string; name: string }[] }[];
  /** Shown to a happy customer after they submit. Null until the owner sets one. */
  reviewUrl: string | null;
}

/**
 * The feedback questionnaire, as a short stepped form.
 *
 * Why steps rather than one long page: nine rating questions on one screen read
 * as a survey, and surveys get abandoned; the same nine in four steps of two or
 * three read as a few quick taps. Why *not* a hard "you must answer" on each
 * step: a tired customer who skips a question is still worth hearing from, so
 * only the final recommend question is required. A visitor who has not ordered
 * yet is asked once, then spared the food and delivery steps entirely.
 *
 * Everything the customer chooses is held here and sent in one call at the end;
 * the server validates all of it again, so nothing here is trusted.
 */
export default function FeedbackForm({ locale, source, order, menu, reviewUrl }: FeedbackFormProps) {
  const t = useTranslations("feedback");

  const [orderedBefore, setOrderedBefore] = useState<string | null>(order ? "order" : null);
  const [dishes, setDishes] = useState<string[]>(() => order?.dishes.map((d) => d.slug) ?? []);
  const [favourite, setFavourite] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [heardFrom, setHeardFrom] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [contactName, setContactName] = useState(order?.name ?? "");
  const [contactEmail, setContactEmail] = useState(order?.email ?? "");
  const [quoteOk, setQuoteOk] = useState(false);
  const [honeypot, setHoneypot] = useState("");

  const [stepIndex, setStepIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ recommend: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Someone who has ordered (or arrived from an order link) gets the food and
  // delivery steps; someone who is just looking goes straight to the website.
  const hasOrdered = Boolean(order) || orderedBefore === "many" || orderedBefore === "once";
  const steps: Step[] = [
    ...(order ? [] : (["intro"] as Step[])),
    ...(hasOrdered ? (["order", "food", "delivery"] as Step[]) : []),
    "website",
    "finish",
  ];
  const step = steps[Math.min(stepIndex, steps.length - 1)];
  const isLast = stepIndex >= steps.length - 1;

  // Keep the heading in view when the step changes, so a phone user who tapped
  // "Next" at the bottom lands at the top of the new questions, not mid-form.
  useEffect(() => {
    if (stepIndex === 0 && !done) return;
    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    headingRef.current?.focus({ preventScroll: true });
  }, [stepIndex, done]);

  const setAnswer = (id: string, value: number) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setError(null);
  };

  const toggleDish = (slug: string) => {
    setDishes((prev) => {
      const next = prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug];
      // A favourite has to be one of the chosen dishes.
      setFavourite((fav) => (fav && !next.includes(fav) ? null : fav));
      return next;
    });
  };

  function goNext() {
    if (step === "intro" && !orderedBefore) return;
    setError(null);
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  function submit() {
    if (!answers[RECOMMEND_ID]) {
      setError(t("errors.needRecommend"));
      return;
    }
    if (contactOk && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail.trim())) {
      setError(t("errors.needEmail"));
      return;
    }

    const payload: FeedbackPayload = {
      reference: order?.reference,
      token: order?.token,
      source,
      locale,
      orderedBefore: orderedBefore ?? undefined,
      dishes,
      favourite: favourite ?? undefined,
      answers,
      heardFrom: heardFrom ?? undefined,
      comment: comment.trim() || undefined,
      contactOk,
      contactName: contactOk ? contactName.trim() || undefined : undefined,
      contactEmail: contactOk ? contactEmail.trim() : undefined,
      quoteOk: quoteOk && comment.trim().length > 0,
      website: honeypot,
    };

    setError(null);
    startTransition(async () => {
      try {
        const result = await submitFeedbackAction(payload);
        if (result.ok) setDone({ recommend: result.recommend });
        else setError(t(`errors.${result.error}`));
      } catch {
        setError(t("errors.failed"));
      }
    });
  }

  // ------------------------------------------------------------------ done
  if (done) {
    const happy = done.recommend >= HAPPY_AT_OR_ABOVE && Boolean(reviewUrl);
    return (
      <div
        ref={cardRef}
        className="rounded-3xl border border-charcoal-600/12 bg-cream-50 p-8 text-center sm:p-12"
      >
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
          <CheckCircle2 size={30} />
        </span>
        <h2
          ref={headingRef}
          tabIndex={-1}
          className="mt-6 font-display text-3xl font-semibold text-charcoal-600 outline-none"
        >
          {t("thanks.title")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-base text-ink/70">{t("thanks.text")}</p>

        {/* Only the happy get asked for a public review — asking someone who just
            told us the delivery was cold to praise us on Google would be tone-deaf. */}
        {happy && reviewUrl && (
          <div className="mx-auto mt-8 max-w-md rounded-2xl bg-ember-600/8 p-5">
            <p className="text-sm text-ink/75">{t("thanks.reviewText")}</p>
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-full bg-ember-600 px-6 py-3 font-display text-sm font-semibold text-cream-50 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
            >
              <Star size={16} />
              {t("thanks.reviewCta")}
            </a>
          </div>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/menu"
            className="rounded-full bg-charcoal-600 px-6 py-3 font-display text-sm font-semibold text-cream-100 transition-colors hover:bg-ember-600"
          >
            {t("thanks.menu")}
          </Link>
          <Link
            href="/"
            className="rounded-full border border-charcoal-600/20 px-6 py-3 font-display text-sm font-semibold text-charcoal-600 transition-colors hover:border-charcoal-600/50"
          >
            {t("thanks.home")}
          </Link>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------------ steps
  const [privacyBefore, privacyAfter] = t("consent.privacy", { privacy: "\u0001" }).split("\u0001");

  return (
    <div
      ref={cardRef}
      className="scroll-mt-24 rounded-3xl border border-charcoal-600/12 bg-cream-50 p-6 sm:p-8"
    >
      {/* progress */}
      <div className="flex items-center justify-between gap-4 text-xs font-semibold uppercase tracking-[0.14em] text-charcoal-600/60">
        <span>{t("stepOf", { current: stepIndex + 1, total: steps.length })}</span>
        <span>{t(`steps.${step}`)}</span>
      </div>
      <div
        className="mt-3 h-1.5 overflow-hidden rounded-full bg-charcoal-600/10"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={steps.length}
        aria-valuenow={stepIndex + 1}
      >
        <div
          className="h-full rounded-full bg-ember-600 transition-[width] duration-500 ease-brand"
          style={{ width: `${((stepIndex + 1) / steps.length) * 100}%` }}
        />
      </div>

      <h2
        ref={headingRef}
        tabIndex={-1}
        className="mt-7 font-display text-2xl font-semibold text-charcoal-600 outline-none"
      >
        {t(`steps.${step}`)}
      </h2>

      <div className="mt-6 space-y-8">
        {step === "intro" && (
          <Fieldset legend={t("questions.orderedBefore")}>
            <div className="grid gap-2.5">
              {ORDERED_BEFORE_OPTIONS.map((option) => (
                <ChoiceCard
                  key={option}
                  checked={orderedBefore === option}
                  onSelect={() => {
                    setOrderedBefore(option);
                    setError(null);
                  }}
                  name="orderedBefore"
                >
                  {t(`orderedBeforeOptions.${option}`)}
                </ChoiceCard>
              ))}
            </div>
          </Fieldset>
        )}

        {step === "order" && (
          <>
            <Fieldset legend={t("questions.dishes")} hint={t("questions.dishesHint")}>
              {order ? (
                <div className="flex flex-wrap gap-2">
                  {order.dishes.map((dish) => (
                    <Chip
                      key={dish.slug}
                      selected={dishes.includes(dish.slug)}
                      onClick={() => toggleDish(dish.slug)}
                    >
                      {dish.name}
                    </Chip>
                  ))}
                </div>
              ) : (
                <div className="space-y-5">
                  {menu.map((category) => (
                    <div key={category.id}>
                      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-charcoal-600/50">
                        {category.label}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {category.items.map((dish) => (
                          <Chip
                            key={dish.slug}
                            selected={dishes.includes(dish.slug)}
                            onClick={() => toggleDish(dish.slug)}
                          >
                            {dish.name}
                          </Chip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Fieldset>

            {dishes.length >= 2 && (
              <Fieldset legend={t("questions.favourite")} hint={t("optional")}>
                <div className="flex flex-wrap gap-2">
                  {dishes.map((slug) => {
                    const name =
                      order?.dishes.find((d) => d.slug === slug)?.name ??
                      menu.flatMap((c) => c.items).find((d) => d.slug === slug)?.name ??
                      slug;
                    return (
                      <Chip
                        key={slug}
                        selected={favourite === slug}
                        onClick={() => setFavourite(favourite === slug ? null : slug)}
                        radio
                      >
                        {name}
                      </Chip>
                    );
                  })}
                </div>
              </Fieldset>
            )}
          </>
        )}

        {(step === "food" || step === "delivery" || step === "website") &&
          questionsFor(step)
            .filter((q) => (q.needsOrder ? hasOrdered : true))
            .map((q) => (
              <Likert
                key={q.id}
                id={q.id}
                label={t(`questions.${q.id}`)}
                value={answers[q.id]}
                onChange={(value) => setAnswer(q.id, value)}
                labelFor={(v) => t(`scale.${v}`)}
                low={t("scale.1")}
                high={t("scale.5")}
                unanswered={t("unanswered")}
              />
            ))}

        {step === "finish" && (
          <>
            <Likert
              id={RECOMMEND_ID}
              label={t(`questions.${RECOMMEND_ID}`)}
              value={answers[RECOMMEND_ID]}
              onChange={(value) => setAnswer(RECOMMEND_ID, value)}
              labelFor={(v) => t(`recommendScale.${v}`)}
              low={t("recommendScale.1")}
              high={t("recommendScale.5")}
              unanswered={t("unanswered")}
              required
              requiredLabel={t("required")}
            />

            <Fieldset legend={t("questions.heard")} hint={t("optional")}>
              <div className="flex flex-wrap gap-2">
                {HEARD_FROM_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    selected={heardFrom === option}
                    onClick={() => setHeardFrom(heardFrom === option ? null : option)}
                    radio
                  >
                    {t(`heardOptions.${option}`)}
                  </Chip>
                ))}
              </div>
            </Fieldset>

            <div>
              <label htmlFor="fb-comment" className="block text-base font-semibold text-charcoal-600">
                {t("questions.comment")}{" "}
                <span className="text-sm font-normal text-ink/50">· {t("optional")}</span>
              </label>
              <textarea
                id="fb-comment"
                value={comment}
                onChange={(e) => setComment(e.target.value.slice(0, COMMENT_MAX))}
                rows={4}
                placeholder={t("questions.commentPlaceholder")}
                className="mt-3 w-full rounded-2xl border border-charcoal-600/15 bg-cream-50 px-4 py-3 text-base text-ink placeholder:text-ink/40 focus:border-ember-600 focus:outline-none"
              />
              <p className="mt-1 text-right text-xs tabular-nums text-ink/40">
                {comment.length}/{COMMENT_MAX}
              </p>
            </div>

            <div className="space-y-4 rounded-2xl bg-cream-100 p-5">
              <Consent
                checked={contactOk}
                onChange={setContactOk}
                label={t("consent.contact")}
              />
              {contactOk && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder={t("consent.contactName")}
                    autoComplete="name"
                    aria-label={t("consent.contactName")}
                    className="h-12 rounded-xl border border-charcoal-600/15 bg-cream-50 px-4 text-base focus:border-ember-600 focus:outline-none"
                  />
                  <input
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder={t("consent.contactEmail")}
                    autoComplete="email"
                    aria-label={t("consent.contactEmail")}
                    className="h-12 rounded-xl border border-charcoal-600/15 bg-cream-50 px-4 text-base focus:border-ember-600 focus:outline-none"
                  />
                </div>
              )}
              {comment.trim().length > 0 && (
                <Consent checked={quoteOk} onChange={setQuoteOk} label={t("consent.quote")} />
              )}
              <p className="text-xs leading-relaxed text-ink/55">
                {privacyBefore}
                <Link href="/privacy" className="font-semibold underline underline-offset-2 hover:text-ember-600">
                  {t("consent.privacyLink")}
                </Link>
                {privacyAfter}
              </p>
            </div>

            {/* Honeypot. Positioned off-screen rather than display:none (some bots
                skip hidden fields), hidden from assistive tech and from tabbing —
                a human never meets it, so anything typed here is a script. */}
            <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
              <label>
                Website
                <input
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={honeypot}
                  onChange={(e) => setHoneypot(e.target.value)}
                />
              </label>
            </div>
          </>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-6 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <div className="mt-8 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStepIndex((i) => Math.max(i - 1, 0));
          }}
          disabled={stepIndex === 0 || pending}
          className="inline-flex items-center gap-2 rounded-full px-5 py-3 font-display text-sm font-semibold text-charcoal-600/70 transition-colors hover:text-charcoal-600 disabled:invisible"
        >
          <ArrowLeft size={16} />
          {t("back")}
        </button>

        {isLast ? (
          <button
            type="button"
            onClick={submit}
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 disabled:opacity-60"
          >
            {pending ? t("sending") : t("submit")}
            {!pending && <Check size={16} />}
          </button>
        ) : (
          <button
            type="button"
            onClick={goNext}
            disabled={step === "intro" && !orderedBefore}
            className="inline-flex items-center gap-2 rounded-full bg-charcoal-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-100 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-600 disabled:opacity-40 disabled:hover:translate-y-0 disabled:hover:bg-charcoal-600"
          >
            {t("next")}
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- parts */

function Fieldset({
  legend,
  hint,
  children,
}: {
  legend: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="text-base font-semibold text-charcoal-600">
        {legend}
        {hint && <span className="ml-2 text-sm font-normal text-ink/50">· {hint}</span>}
      </legend>
      <div className="mt-3">{children}</div>
    </fieldset>
  );
}

/**
 * One 1–5 question. A real radio group — arrow keys move between the five, a
 * screen reader hears "Agree, 4 of 5" — dressed as a segmented control. The
 * two ends are named under it and the chosen label is spelled out, so the
 * numbers never have to be decoded.
 */
function Likert({
  id,
  label,
  value,
  onChange,
  labelFor,
  low,
  high,
  unanswered,
  required,
  requiredLabel,
}: {
  id: string;
  label: string;
  value: number | undefined;
  onChange: (value: number) => void;
  labelFor: (value: number) => string;
  low: string;
  high: string;
  unanswered: string;
  required?: boolean;
  requiredLabel?: string;
}) {
  return (
    <fieldset>
      <legend className="text-base font-semibold leading-snug text-charcoal-600">
        {label}
        {required && requiredLabel && (
          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-ember-700">
            {requiredLabel}
          </span>
        )}
      </legend>

      <div className="mt-3 grid grid-cols-5 gap-2">
        {SCALE_VALUES.map((n) => {
          const selected = value === n;
          return (
            <label key={n} className="relative">
              <input
                type="radio"
                name={`fb-${id}`}
                value={n}
                checked={selected}
                onChange={() => onChange(n)}
                className="peer sr-only"
                aria-label={`${labelFor(n)} (${n}/5)`}
              />
              <span
                aria-hidden="true"
                className={`flex h-12 cursor-pointer items-center justify-center rounded-xl border font-display text-base font-semibold transition-[background-color,border-color,color,scale] duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ember-600 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-cream-50 ${
                  selected
                    ? "scale-[1.04] border-ember-600 bg-ember-600 text-cream-50 shadow-sm"
                    : "border-charcoal-600/15 bg-cream-50 text-charcoal-600/70 hover:border-ember-600/50 hover:text-charcoal-600"
                }`}
              >
                {n}
              </span>
            </label>
          );
        })}
      </div>

      <div className="mt-2 flex items-start justify-between gap-3 text-xs text-ink/50">
        <span>{low}</span>
        <span className="text-right">{high}</span>
      </div>
      <p
        className={`mt-1 h-5 text-center text-sm font-semibold ${
          value ? "text-ember-700" : "text-transparent"
        }`}
        aria-live="polite"
      >
        {value ? labelFor(value) : unanswered}
      </p>
    </fieldset>
  );
}

/** A selectable pill. `radio` for pick-one groups, otherwise a pick-many toggle. */
function Chip({
  selected,
  onClick,
  children,
  radio,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
  radio?: boolean;
}) {
  return (
    <button
      type="button"
      role={radio ? "radio" : "checkbox"}
      aria-checked={selected}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
        selected
          ? "border-ember-600 bg-ember-600 text-cream-50"
          : "border-charcoal-600/20 bg-cream-50 text-charcoal-600/80 hover:border-charcoal-600/45"
      }`}
    >
      {selected && <Check size={14} aria-hidden="true" />}
      {children}
    </button>
  );
}

function ChoiceCard({
  checked,
  onSelect,
  name,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  name: string;
  children: React.ReactNode;
}) {
  return (
    <label className="relative block">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="peer sr-only"
      />
      <span
        className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-5 py-3 text-base font-medium transition-colors duration-200 peer-focus-visible:ring-2 peer-focus-visible:ring-ember-600 peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-cream-50 ${
          checked
            ? "border-ember-600 bg-ember-600/8 text-charcoal-600"
            : "border-charcoal-600/15 bg-cream-50 text-charcoal-600/80 hover:border-charcoal-600/40"
        }`}
      >
        <span
          aria-hidden="true"
          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
            checked ? "border-ember-600 bg-ember-600" : "border-charcoal-600/30"
          }`}
        >
          {checked && <span className="h-1.5 w-1.5 rounded-full bg-cream-50" />}
        </span>
        {children}
      </span>
    </label>
  );
}

function Consent({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug text-charcoal-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--color-ember-600)]"
      />
      {label}
    </label>
  );
}
