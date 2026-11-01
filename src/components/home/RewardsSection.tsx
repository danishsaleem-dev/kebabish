import NextLink from "next/link";
import { getTranslations } from "next-intl/server";
import { ArrowRight, Gift, Sparkles, Users } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { formatEuro, fromCents } from "@/lib/money";
import { getRewardsConfig } from "@/lib/rewards";
import SectionEyebrow from "@/components/home/SectionEyebrow";

/**
 * Points, the welcome bonus and inviting a friend, on one card. Every number comes from the live
 * rules, and the section renders nothing while the programme is off, so the homepage can't
 * promise something a customer can't get.
 */
export default async function RewardsSection({ locale }: { locale: string }) {
  const config = await getRewardsConfig();
  if (!config.enabled) return null;

  const t = await getTranslations({ locale, namespace: "home" });
  const fmt = (value: number) => value.toLocaleString(locale === "nl" ? "nl-NL" : "en-GB");
  const friends = config.referralEnabled;
  const friendAmount = formatEuro(fromCents(config.referralFriendCents));

  const tiles = [
    ...(config.welcomePoints > 0
      ? [
          {
            icon: Gift,
            label: t("rewardsWelcomeLabel"),
            value: t("rewardsWelcomeValue", { points: fmt(config.welcomePoints) }),
            text: t("rewardsWelcomeText"),
          },
        ]
      : []),
    {
      icon: Sparkles,
      label: t("rewardsEarnLabel"),
      value: t("rewardsEarnValue", { points: fmt(config.pointsPerEuro) }),
      text: t("rewardsEarnText", {
        goal: fmt(config.redeemStepPoints),
        amount: formatEuro(fromCents(config.redeemStepCents)),
      }),
    },
    ...(friends
      ? [
          {
            icon: Users,
            label: t("rewardsFriendLabel"),
            value: t("rewardsFriendValue", { amount: friendAmount }),
            text: t("rewardsFriendText", { points: fmt(config.referralRewardPoints) }),
          },
        ]
      : []),
  ];

  return (
    <section className="mx-auto max-w-6xl px-5 py-14 sm:px-6 sm:py-20">
      <div
        data-reveal="scale"
        className="relative overflow-hidden rounded-[2rem] bg-charcoal-800 p-6 text-cream-100 sm:p-10 lg:p-12"
      >
        <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_90%_10%,rgba(169,80,38,0.34),transparent_70%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center lg:gap-12">
          <div className="min-w-0">
            <SectionEyebrow tone="light">{t("rewardsEyebrow")}</SectionEyebrow>
            <h2 className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-50 sm:text-4xl">
              {t("rewardsTitle")}
            </h2>
            <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-cream-200/75 sm:text-base">
              {t("rewardsText")}
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
              <NextLink
                href={`/signup?lang=${locale}`}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-ember-600 px-6 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
              >
                {t("rewardsSignup")}
                <ArrowRight size={16} aria-hidden="true" />
              </NextLink>
              <Link
                href="/rewards"
                className="inline-flex items-center justify-center rounded-full border border-cream-100/25 px-6 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-cream-100/10"
              >
                {t("rewardsHow")}
              </Link>
              {friends && (
                <Link
                  href="/referral"
                  className="px-2 py-1 text-center text-sm font-semibold text-cream-100 underline underline-offset-4"
                >
                  {t("rewardsInvite")}
                </Link>
              )}
            </div>
          </div>

          <ul className="grid gap-3">
            {tiles.map(({ icon: Icon, label, value, text }) => (
              <li key={label} className="flex items-start gap-4 rounded-2xl bg-cream-50/[0.07] p-4 ring-1 ring-cream-100/10 sm:p-5">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-ember-600 text-cream-50">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-cream-200/65">{label}</p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-cream-50 sm:text-xl">{value}</p>
                  <p className="mt-0.5 text-sm text-cream-200/70">{text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
