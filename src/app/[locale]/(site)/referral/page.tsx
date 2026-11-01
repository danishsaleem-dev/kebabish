import type { Metadata } from "next";
import NextLink from "next/link";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { ArrowRight, Gift, Plus, Send, ShoppingBag, Sparkles } from "lucide-react";
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
import ReferralClaim from "@/components/rewards/ReferralClaim";
import ReferralHeroActions from "@/components/rewards/ReferralHeroActions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/referral",
    title: t("referralTitle"),
    description: t("referralDescription"),
  });
}

/**
 * Invite a friend. Serves two people: a customer finding out how it works, and a friend arriving
 * from someone's link (`?code=`), who sees that their discount is ready. Every number comes from
 * the rules in /admin/rewards, and the page doesn't exist while referrals are off.
 */
export default async function ReferralPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const config = await getRewardsConfig();
  if (!config.enabled || !config.referralEnabled) notFound();

  const t = await getTranslations({ locale, namespace: "referral" });
  const tFooter = await getTranslations({ locale, namespace: "footer" });

  const amount = formatEuro(fromCents(config.referralFriendCents));
  const points = config.referralRewardPoints.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");
  const worth = formatEuro(fromCents(valueOfPoints(config.referralRewardPoints, config)));

  const steps = [
    { icon: Send, title: t("step1Title"), text: t("step1Text") },
    { icon: ShoppingBag, title: t("step2Title"), text: t("step2Text", { amount }) },
    { icon: Sparkles, title: t("step3Title"), text: t("step3Text", { points, worth }) },
  ];

  // What inviting adds up to, from the real rules: one friend, a few, and the monthly limit.
  const ladder = [...new Set([1, 5, config.referralMonthlyCap])]
    .filter((friends) => friends <= config.referralMonthlyCap)
    .sort((a, b) => a - b)
    .map((friends) => ({
      friends,
      points: (friends * config.referralRewardPoints).toLocaleString(locale === "nl" ? "nl-NL" : "en-GB"),
      worth: formatEuro(fromCents(valueOfPoints(friends * config.referralRewardPoints, config))),
    }));

  const faq = [
    { q: t("faq1Q"), a: t("faq1A") },
    { q: t("faq2Q"), a: t("faq2A") },
    { q: t("faq3Q"), a: t("faq3A", { cap: config.referralMonthlyCap }) },
    { q: t("faq4Q"), a: t("faq4A") },
    { q: t("faq5Q"), a: t("faq5A") },
    { q: t("faq6Q"), a: t("faq6A") },
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
      <BreadcrumbSchema locale={locale} items={[{ name: tFooter("referral"), path: "/referral" }]} />

      {/* ---- hero ------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-charcoal-900 text-cream-100">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_40%,rgba(169,80,38,0.34),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgba(169,80,38,0.18),transparent_70%)]" />
        <div className="grain absolute inset-0 opacity-70" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14">
          <div className="min-w-0">
            <ReferralClaim amount={amount} />
            <SectionEyebrow tone="light">{t("eyebrow")}</SectionEyebrow>
            <h1
              data-reveal-mask
              className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.08] text-cream-50 sm:text-5xl"
            >
              <MaskedWords text={t("title", { amount })} />
            </h1>
            <p data-reveal className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream-200/75 sm:text-lg">
              {t("intro", { amount, points })}
            </p>
            <ReferralHeroActions>
              <div data-reveal className="mt-8 flex flex-col gap-3 sm:flex-row">
              <NextLink href="/dashboard" className={primaryCta}>
                {t("ctaLink")}
                <ArrowRight size={17} />
              </NextLink>
              <Link href="/menu" className={secondaryCta}>
                {t("ctaMenu")}
              </Link>
            </div>
            </ReferralHeroActions>
          </div>

          {/* Two people, one gift each. */}
          <div aria-hidden="true" data-reveal="scale" className="relative mx-auto w-full max-w-sm lg:max-w-md">
            <div className="absolute inset-[8%] rounded-full bg-ember-600/30 blur-3xl" />
            <div className="relative -rotate-2 rounded-[1.75rem] bg-cream-50 p-6 text-charcoal-700 shadow-2xl shadow-charcoal-950/50">
              <p className="text-xs font-medium text-ink/55">{t("cardFriend")}</p>
              <p className="mt-1 font-display text-3xl font-semibold text-charcoal-700">
                {t("cardFriendValue", { amount })}
              </p>
            </div>
            <span className="absolute left-1/2 top-1/2 z-10 flex h-12 w-12 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-charcoal-900 text-ember-400 ring-4 ring-charcoal-900">
              <Gift size={20} />
            </span>
            <div className="relative mt-3 rotate-2 rounded-[1.75rem] bg-linear-to-br from-ember-500 via-ember-600 to-ember-800 p-6 text-cream-50 shadow-2xl shadow-charcoal-950/50">
              <p className="text-xs font-medium text-cream-50/75">{t("cardYou")}</p>
              <p className="mt-1 font-display text-3xl font-semibold">{t("cardYouValue", { points })}</p>
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
          {steps.map(({ icon: Icon, title, text }, i) => (
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
              <p className="relative mt-2 text-sm leading-relaxed text-ink/60">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* ---- what it adds up to --------------------------------------------------- */}
      <section className="bg-charcoal-900 text-cream-100">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-20">
          <div className="max-w-2xl">
            <SectionEyebrow tone="light">{t("ladderEyebrow")}</SectionEyebrow>
            <h2 className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-50 sm:text-4xl">
              {t("ladderTitle")}
            </h2>
          </div>
          <ul data-reveal-group className="mt-10 grid gap-3 sm:gap-4 md:grid-cols-3">
            {ladder.map((step) => (
              <li key={step.friends} data-reveal className="rounded-3xl bg-cream-50/[0.06] p-6 ring-1 ring-cream-100/10">
                <p className="text-sm font-medium text-cream-200/70">{t("ladderFriends", { count: step.friends })}</p>
                <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-cream-50">
                  {t("ladderPoints", { points: step.points })}
                </p>
                <p className="mt-1 text-sm font-semibold text-ember-400">{t("ladderWorth", { worth: step.worth })}</p>
              </li>
            ))}
          </ul>
          <p className="mt-5 text-sm text-cream-200/60">{t("ladderNote", { cap: config.referralMonthlyCap })}</p>
        </div>
      </section>

      {/* ---- questions ------------------------------------------------------------ */}
      <section className="mx-auto max-w-3xl px-5 pb-16 sm:px-6 sm:pb-24">
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
              <details name="referral-faq" className="group py-5 [&_summary::-webkit-details-marker]:hidden">
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
                {t("closingSignup")}
                <ArrowRight size={17} />
              </NextLink>
              <NextLink href="/dashboard" className={secondaryCta}>
                {t("ctaLink")}
              </NextLink>
            </div>
          </div>
        </div>
      </section>

      <FeedbackCta locale={locale} />
    </div>
  );
}
