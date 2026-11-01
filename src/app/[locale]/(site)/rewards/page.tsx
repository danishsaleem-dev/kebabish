import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, BadgePercent, Gift, Plus, ShoppingBag, Sparkles } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { languageTag, pageMetadata, websiteNode } from "@/lib/seo";
import { formatEuro, fromCents } from "@/lib/money";
import { getRewardsConfig } from "@/lib/rewards";
import { valueOfPoints } from "@/lib/rewards-math";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import JsonLd from "@/components/JsonLd";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import FeedbackCta from "@/components/feedback/FeedbackCta";
import BrandLogo from "@/components/shared/BrandLogo";
import RewardsCalculator from "@/components/rewards/RewardsCalculator";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/rewards",
    title: t("rewardsTitle"),
    description: t("rewardsDescription"),
  });
}

/**
 * Kebabish Punten, explained. Its job is to turn a visitor into an account and a first order.
 *
 * Every number comes from the rules in /admin/rewards, so this page can't promise something
 * checkout doesn't do, and while the programme is switched off the page doesn't exist at all
 * (it also leaves the footer and the sitemap). Only what is built is described: referrals and
 * birthdays don't appear here until they are real.
 *
 * Copy is in `messages/*.json` under `rewards`. /signup and /dashboard sit outside the locale
 * routing, hence the plain next/link for those two.
 */
export default async function RewardsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const config = await getRewardsConfig();
  if (!config.enabled) notFound();

  const t = await getTranslations({ locale, namespace: "rewards" });
  const tNav = await getTranslations({ locale, namespace: "footer" });

  const num = (n: number) => n.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");
  const points = num(config.pointsPerEuro);
  const step = num(config.redeemStepPoints);
  const amount = formatEuro(fromCents(config.redeemStepCents));
  const welcome = num(config.welcomePoints);
  const welcomeAmount = formatEuro(fromCents(valueOfPoints(config.welcomePoints, config)));

  const steps = [
    { icon: ShoppingBag, title: t("step1Title"), stat: t("step1Stat"), text: t("step1Text") },
    { icon: Sparkles, title: t("step2Title"), stat: t("step2Stat", { points }), text: t("step2Text") },
    { icon: BadgePercent, title: t("step3Title"), stat: t("step3Stat", { step, amount }), text: t("step3Text") },
  ];

  const faq = [
    { q: t("faq1Q"), a: t("faq1A", { points }) },
    { q: t("faq2Q"), a: t("faq2A", { step, amount }) },
    { q: t("faq3Q"), a: t("faq3A", { share: config.maxSharePercent }) },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
    { q: t("faq6Q"), a: t("faq6A") },
    { q: t("faq7Q"), a: t("faq7A") },
    { q: t("faq8Q"), a: t("faq8A") },
  ];

  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: languageTag(locale),
    isPartOf: websiteNode(locale),
    mainEntity: faq.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: { "@type": "Answer", text: entry.a },
    })),
  };

  const primaryCta =
    "inline-flex items-center justify-center gap-2.5 rounded-full bg-ember-600 px-7 py-4 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-ember-900/30 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500";
  const secondaryCta =
    "inline-flex items-center justify-center gap-2.5 rounded-full border border-cream-100/25 px-7 py-4 font-display text-sm font-semibold text-cream-50 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-cream-100/10";

  return (
    <div className="bg-cream-200">
      <Motion />
      <JsonLd data={faqSchema} />
      <BreadcrumbSchema locale={locale} items={[{ name: tNav("rewards"), path: "/rewards" }]} />

      {/* ---- hero ------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-charcoal-900 text-cream-100">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_40%,rgba(169,80,38,0.34),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgba(169,80,38,0.18),transparent_70%)]" />
        <div className="grain absolute inset-0 opacity-70" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div className="min-w-0">
            <SectionEyebrow tone="light">{t("eyebrow")}</SectionEyebrow>
            <h1
              data-reveal-mask
              className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.08] text-cream-50 sm:text-5xl"
            >
              <MaskedWords text={t("title")} />
            </h1>
            <p data-reveal className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream-200/75 sm:text-lg">
              {t("intro")}
            </p>

            <div data-reveal className="mt-8 flex flex-col gap-3 sm:flex-row">
              <NextLink href="/signup" className={primaryCta}>
                {t("ctaSignup")}
                <ArrowRight size={17} />
              </NextLink>
              <Link href="/menu" className={secondaryCta}>
                {t("ctaMenu")}
              </Link>
            </div>

            <p data-reveal className="mt-5 text-sm text-cream-200/65">
              {t("haveAccount")}{" "}
              <NextLink href="/dashboard" className="font-semibold text-cream-50 underline underline-offset-4 hover:text-ember-400">
                {t("seePoints")}
              </NextLink>
            </p>
          </div>

          {/* The points card: what the customer ends up with, in their hand. */}
          <div aria-hidden="true" data-reveal="scale" className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="absolute inset-[8%] rounded-full bg-ember-600/30 blur-3xl" />
            <div className="relative -rotate-3 overflow-hidden rounded-[1.75rem] bg-linear-to-br from-ember-500 via-ember-600 to-ember-800 p-6 text-cream-50 shadow-2xl shadow-charcoal-950/60 ring-1 ring-cream-50/15 transition-transform duration-700 ease-brand hover:rotate-0 sm:p-7">
              <div className="grain absolute inset-0 opacity-40" />
              <div className="relative">
                <div className="flex items-start justify-between gap-4">
                  <BrandLogo src="/logo/kebabish-dark.png" alt="" width={300} height={225} className="h-14 w-auto" />
                  <span className="rounded-full bg-charcoal-950/25 px-3 py-1 text-[0.65rem] font-semibold uppercase tracking-[0.16em]">
                    {t("eyebrow")}
                  </span>
                </div>
                <p className="mt-8 text-xs font-medium text-cream-50/75">{t("cardBalance")}</p>
                <p className="mt-0.5 font-display text-5xl font-semibold tabular-nums">{step}</p>
                <div className="mt-5 h-2 overflow-hidden rounded-full bg-charcoal-950/25">
                  <div className="h-full w-full rounded-full bg-cream-50" />
                </div>
                <p className="mt-2.5 flex items-center gap-2 text-sm font-semibold">
                  <BadgePercent size={16} />
                  {t("cardGoal", { step, amount })}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---- three steps --------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow>{t("stepsEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
          >
            <MaskedWords text={t("stepsTitle")} />
          </h2>
        </div>
        <ol data-reveal-group className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3">
          {steps.map(({ icon: Icon, title, stat, text }, i) => (
            <li
              key={title}
              data-reveal
              className="group relative overflow-hidden rounded-3xl bg-cream-50 p-6 ring-1 ring-charcoal-600/8 transition-[translate,box-shadow] duration-500 ease-brand hover:-translate-y-1 hover:shadow-xl hover:shadow-charcoal-950/8"
            >
              <span aria-hidden="true" className="absolute -right-2 -top-6 font-display text-[7rem] font-semibold leading-none text-charcoal-600/[0.05]">
                {i + 1}
              </span>
              <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600 transition-[background-color,color,transform] duration-500 group-hover:-rotate-6 group-hover:bg-ember-600 group-hover:text-cream-50">
                <Icon size={21} />
              </span>
              <h3 className="relative mt-5 font-display text-lg font-semibold text-charcoal-600">{title}</h3>
              <p className="relative mt-1 font-display text-xl font-semibold text-ember-600">{stat}</p>
              <p className="relative mt-2 text-sm leading-relaxed text-ink/60">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- what it adds up to --------------------------------------------------- */}
      <section className="relative overflow-hidden bg-charcoal-800 text-cream-100">
        <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_0%_0%,rgba(169,80,38,0.28),transparent_70%)]" />
        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-10 px-5 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.85fr_1.15fr] lg:gap-14">
          <div className="min-w-0">
            <SectionEyebrow tone="light">{t("calcEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-50 sm:text-4xl"
            >
              <MaskedWords text={t("calcTitle")} />
            </h2>
            <p data-reveal className="mt-4 max-w-md text-pretty text-base leading-relaxed text-cream-200/70">
              {t("calcText")}
            </p>
          </div>
          <div data-reveal className="min-w-0">
            <RewardsCalculator config={config} />
          </div>
        </div>
      </section>

      {/* ---- welcome bonus (only while there is one) ------------------------------- */}
      {config.welcomePoints > 0 && (
        <section className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
          <div
            data-reveal="scale"
            className="flex flex-col gap-5 rounded-[2rem] bg-ember-600 p-6 text-cream-50 sm:flex-row sm:items-center sm:gap-7 sm:p-10"
          >
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cream-50/15">
              <Gift size={28} aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-cream-50/80">
                {t("welcomeEyebrow")}
              </p>
              <h2 className="mt-1 text-balance font-display text-2xl font-semibold text-cream-50 sm:text-3xl">
                {t("welcomeTitle", { points: welcome })}
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-cream-50/85 sm:text-base">
                {t("welcomeText", { points: welcome, amount: welcomeAmount })}
              </p>
            </div>
          </div>
        </section>
      )}

      {/* ---- questions: native <details>, so the answers are in the HTML while closed ---- */}
      <section className="mx-auto max-w-3xl px-5 py-16 sm:px-6 sm:py-24">
        <SectionEyebrow>{t("faqEyebrow")}</SectionEyebrow>
        <h2
          data-reveal-mask
          className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
        >
          <MaskedWords text={t("faqTitle")} />
        </h2>
        <ul data-reveal-group className="mt-8 divide-y divide-charcoal-600/12">
          {faq.map((entry) => (
            <li key={entry.q} data-reveal>
              <details name="rewards-faq" className="group py-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-5 font-display text-base font-semibold text-charcoal-600 transition-colors duration-300 marker:content-none hover:text-ember-700 sm:text-lg">
                  {entry.q}
                  <span
                    aria-hidden="true"
                    className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-charcoal-600/20 text-charcoal-600 transition-[background-color,border-color,color,rotate] duration-300 ease-brand group-open:rotate-45 group-open:border-ember-600 group-open:bg-ember-600 group-open:text-cream-50"
                  >
                    <Plus size={15} />
                  </span>
                </summary>
                <p className="mt-3 max-w-2xl text-pretty text-[0.95rem] leading-relaxed text-ink/70">{entry.a}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- closing ------------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div data-reveal="scale" className="relative overflow-hidden rounded-[2rem] bg-charcoal-800 p-6 text-center text-cream-100 sm:p-12">
          <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(169,80,38,0.35),transparent_70%)]" />
          <div className="relative">
            <h2 className="text-balance font-display text-2xl font-semibold text-cream-50 sm:text-4xl">{t("closingTitle")}</h2>
            <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-cream-200/70 sm:text-base">{t("closingText")}</p>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <NextLink href="/signup" className={primaryCta}>
                {t("ctaSignup")}
                <ArrowRight size={17} />
              </NextLink>
              <Link href="/menu" className={secondaryCta}>
                {t("ctaMenu")}
              </Link>
            </div>
            <p className="mt-6 text-xs text-cream-200/50">{t("smallPrint")}</p>
          </div>
        </div>
      </section>

      <FeedbackCta locale={locale} />
    </div>
  );
}
