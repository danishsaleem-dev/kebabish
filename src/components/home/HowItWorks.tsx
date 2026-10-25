import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Check, Home, Lock, Plus, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getFeaturedItems, getPublicMenu } from "@/lib/public-menu";
import { effectiveHours, generateDaySlots } from "@/lib/delivery-slots";
import { formatEuro } from "@/lib/money";
import type { StoredSettings } from "@/lib/admin/store/types";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import PaymentMarks from "@/components/home/PaymentMarks";
import BrandLogo from "@/components/shared/BrandLogo";

/**
 * "How it works" — four steps from choosing to the doorbell.
 *
 * Each step carries a small illustration built from the real thing rather than stock
 * art: the dishes are the ones on the menu, the time windows are today's real slot
 * grid from the opening hours in Settings, and the payment marks are the methods
 * checkout offers. So the picture can't drift from what a customer will actually see.
 *
 * Motion is CSS only (nothing here is a client component): the ember line joining the
 * steps draws itself as the section scrolls through the viewport (a scroll-driven
 * animation, `.how-line-*` in globals.css — browsers without it simply show the line
 * drawn), and each illustration has one gentle loop. All of it stops under
 * `prefers-reduced-motion`. Every word is in the server HTML.
 */
export default async function HowItWorks({
  locale,
  settings,
}: {
  locale: string;
  settings: Pick<StoredSettings, "hours" | "slotMinutes" | "slotCapacity">;
}) {
  const t = await getTranslations({ locale });
  // Featured dishes first, topped up from the rest of the menu (photo first) to three.
  const featured = (await getFeaturedItems(locale)).filter((d) => d.price != null && !d.soldOut);
  const rest = (await getPublicMenu(locale))
    .flatMap((c) => c.items)
    .filter((d) => d.price != null && !d.soldOut && !featured.some((f) => f.slug === d.slug))
    .sort((a, b) => Number(Boolean(b.image)) - Number(Boolean(a.image)));
  const dishes = [...featured, ...rest].slice(0, 3);

  // The first open day's first six windows: real times, not decoration.
  const firstOpen = effectiveHours(settings).find((d) => !d.closed);
  const slots = firstOpen ? generateDaySlots(firstOpen).slice(0, 6) : [];

  const steps = [
    { title: t("home.how1Title"), text: t("home.how1Text"), art: <PickArt dishes={dishes} /> },
    { title: t("home.how2Title"), text: t("home.how2Text"), art: <SlotArt slots={slots.map((s) => s.start)} /> },
    {
      title: t("home.how3Title"),
      text: t("home.how3Text"),
      art: <PayArt cardLabel={t("home.payCard")} secureLabel={t("home.paySecure")} />,
    },
    { title: t("home.how4Title"), text: t("home.how4Text"), art: <DeliverArt /> },
  ];

  return (
    <section className="relative overflow-hidden bg-charcoal-950 py-20 text-cream-100 sm:py-28 lg:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(55%_45%_at_15%_0%,rgba(169,80,38,0.30),transparent_70%),radial-gradient(45%_40%_at_95%_100%,rgba(169,80,38,0.22),transparent_70%)]" />
      <div className="grain absolute inset-0 opacity-60" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <SectionEyebrow tone="light">{t("home.howEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-50 sm:text-4xl lg:text-[2.75rem]"
            >
              <MaskedWords text={t("home.howTitle")} />
            </h2>
            <p data-reveal className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream-200/70 sm:text-lg">
              {t("home.howText")}
            </p>
          </div>

          <Link
            data-reveal
            href="/menu"
            className="group hidden items-center gap-2.5 rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-ember-900/30 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 sm:inline-flex"
          >
            {t("home.howCta")}
            <ArrowRight size={16} className="transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>

        <ol data-reveal-group className="relative mt-14 grid gap-10 lg:mt-20 lg:grid-cols-4 lg:gap-6">
          {/* The thread joining the steps: down the left on a phone, across the top on a laptop. */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[1.4rem] top-6 w-0.5 rounded-full bg-cream-100/10 lg:hidden"
          >
            <span className="how-line-y absolute inset-0 origin-top rounded-full bg-linear-to-b from-ember-400 via-ember-500 to-ember-600" />
          </span>
          <span
            aria-hidden="true"
            // Ends at the last node's centre: the 4th column starts at 75% + ¾ of a 1.5rem gap.
            className="absolute left-[1.4rem] right-[calc(25%-2.5rem)] top-[1.4rem] hidden h-0.5 rounded-full bg-cream-100/10 lg:block"
          >
            <span className="how-line-x absolute inset-0 origin-left rounded-full bg-linear-to-r from-ember-400 via-ember-500 to-ember-600" />
          </span>

          {steps.map((step, i) => (
            <li key={step.title} data-reveal className="relative pl-16 lg:pl-0">
              <span className="absolute left-0 top-0 flex h-11 w-11 items-center justify-center rounded-full bg-charcoal-950 font-display text-sm font-bold text-cream-50 ring-2 ring-ember-500 shadow-[0_0_0_6px_rgba(20,18,15,1),0_0_28px_rgba(201,113,62,0.45)] lg:relative">
                {String(i + 1).padStart(2, "0")}
              </span>

              <div className="lg:mt-7">
                <div className="group relative h-40 overflow-hidden rounded-3xl border border-cream-100/10 bg-linear-to-b from-cream-50/[0.07] to-cream-50/[0.02] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition-[border-color,translate] duration-500 hover:-translate-y-1 hover:border-ember-500/40">
                  {step.art}
                </div>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream-50">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-200/65">{step.text}</p>
              </div>
            </li>
          ))}
        </ol>

        <div data-reveal className="mt-12 sm:hidden">
          <Link
            href="/menu"
            className="flex w-full items-center justify-center gap-2.5 rounded-full bg-ember-600 px-7 py-4 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-ember-900/30"
          >
            {t("home.howCta")}
            <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ---- the four illustrations ------------------------------------------- */

type Dish = Awaited<ReturnType<typeof getFeaturedItems>>[number];

/** Step 1: three real dishes; the middle one's "+" taps itself into a tick. */
function PickArt({ dishes }: { dishes: Dish[] }) {
  const rows = dishes;
  // The row that "gets tapped": the middle one, or the only one.
  const hot = Math.min(1, rows.length - 1);
  return (
    <div className="relative flex h-full flex-col justify-center gap-2">
      {rows.length === 0 ? (
        <div className="flex h-full items-center justify-center text-ember-400">
          <UtensilsCrossed size={40} aria-hidden="true" />
        </div>
      ) : (
        rows.map((dish, i) => (
          <div
            key={dish.slug}
            className={`flex items-center gap-2.5 rounded-xl px-2 py-1.5 ${
              i === hot ? "bg-cream-50/10 ring-1 ring-ember-500/40" : "bg-cream-50/[0.04]"
            }`}
          >
            <span className="relative h-8 w-8 shrink-0 overflow-hidden rounded-lg bg-cream-300">
              {dish.image ? (
                <Image src={dish.image} alt="" fill sizes="32px" className="object-cover" />
              ) : (
                <BrandLogo src="/logo/Kebabish-light.png" alt="" width={60} height={45} className="h-auto w-6 opacity-40" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-semibold text-cream-50">{dish.name}</span>
              <span className="block text-[0.65rem] text-cream-200/55">{formatEuro(dish.price as number)}</span>
            </span>
            <span
              className={`relative flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                i === hot ? "bg-ember-600 text-cream-50" : "bg-cream-50/10 text-cream-100/70"
              }`}
            >
              {i === hot ? (
                <>
                  <Plus size={13} strokeWidth={3} className="how-tap-out absolute" aria-hidden="true" />
                  <Check size={13} strokeWidth={3} className="how-tap-in absolute" aria-hidden="true" />
                </>
              ) : (
                <Plus size={13} strokeWidth={3} aria-hidden="true" />
              )}
            </span>
          </div>
        ))
      )}
      <span className="how-tap-badge absolute -right-1 -top-1 flex h-7 items-center gap-1 rounded-full bg-cream-50 px-2 text-[0.65rem] font-bold text-charcoal-700 shadow-lg">
        <ShoppingBag size={12} aria-hidden="true" />1
      </span>
    </div>
  );
}

/** Step 2: the real first windows of the first open day; the chosen one hops along. */
function SlotArt({ slots }: { slots: string[] }) {
  const shown = slots.length > 0 ? slots : ["", "", "", "", "", ""];
  return (
    <div className="grid h-full grid-cols-3 content-center gap-2">
      {shown.map((time, i) => (
        <span
          key={i}
          className="how-slot flex h-10 items-center justify-center rounded-xl border border-cream-100/12 bg-cream-50/[0.04] text-xs font-semibold tabular-nums text-cream-100/80"
          style={{ animationDelay: `${i * 1.1}s` }}
        >
          {time}
        </span>
      ))}
    </div>
  );
}

/** Step 3: the methods checkout offers, under a padlock. */
function PayArt({ cardLabel, secureLabel }: { cardLabel: string; secureLabel: string }) {
  return (
    <div className="relative flex h-full flex-col justify-center gap-3">
      <span className="inline-flex items-center gap-2 self-start rounded-full bg-success/15 px-3 py-1 text-[0.7rem] font-semibold text-success">
        <Lock size={12} aria-hidden="true" />
        {secureLabel}
      </span>
      <PaymentMarks cardLabel={cardLabel} tone="dark" size="sm" />
      <span aria-hidden="true" className="how-shimmer pointer-events-none absolute inset-0" />
    </div>
  );
}

/** Step 4: from the kitchen to a front door, along a dashed road. */
function DeliverArt() {
  const road = "M24 104 C 70 104, 70 40, 120 52 S 170 96, 216 40";
  return (
    <div className="relative h-full">
      <svg viewBox="0 0 240 128" className="h-full w-full" aria-hidden="true">
        <path d={road} fill="none" stroke="rgba(244,239,224,0.12)" strokeWidth="10" strokeLinecap="round" />
        <path d={road} fill="none" stroke="#c9713e" strokeWidth="2" strokeDasharray="5 7" strokeLinecap="round" />
        {/* The moving courier — and a still one for reduced motion. */}
        <g className="motion-reduce:hidden">
          <circle r="13" fill="rgba(201,113,62,0.25)" />
          <circle r="7" fill="#c9713e" />
          <animateMotion dur="4.5s" repeatCount="indefinite" path={road} />
        </g>
        <circle cx="120" cy="52" r="7" fill="#c9713e" className="hidden motion-reduce:block" />
        {/* Ends of the road, inside the drawing so they stay on it at any size. */}
        <foreignObject x="4" y="84" width="40" height="40">
          <span className="flex h-full w-full items-center justify-center rounded-xl bg-charcoal-800 text-ember-400 ring-1 ring-cream-100/15">
            <UtensilsCrossed size={18} />
          </span>
        </foreignObject>
        <foreignObject x="196" y="20" width="40" height="40">
          <span className="flex h-full w-full items-center justify-center rounded-xl bg-ember-600 text-cream-50">
            <Home size={18} />
          </span>
        </foreignObject>
      </svg>
    </div>
  );
}
