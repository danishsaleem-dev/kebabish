import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { formatEuro, fromCents } from "@/lib/money";
import { progressToReward, valueOfPoints } from "@/lib/rewards-math";
import {
  getReferralCode,
  referralLink,
  referralShareText,
  referralStats,
  referralTracks,
} from "@/lib/referrals";
import { accountLocale, sitePrefix } from "@/lib/account-page";
import { customerRewards } from "@/lib/account-data";
import { formatNumber, formatShortDate, ledgerEntries } from "@/lib/account-view";
import PointsHero from "@/components/dashboard/PointsHero";
import RewardsCard from "@/components/dashboard/RewardsCard";
import ReferralCard from "@/components/dashboard/ReferralCard";
import { PageHeading } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

/**
 * Kebabish Punten and the invite link. The whole page only exists while the
 * programme is on — the navigation hides the tab, and a bookmark or a typed
 * URL lands back on the overview rather than on an empty screen.
 */
export default async function AccountRewardsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const locale = await accountLocale(user.id);
  const rewards = await customerRewards(user.id);
  if (!rewards) redirect("/dashboard");

  const t = await getTranslations({ locale, namespace: "account" });
  const n = formatNumber(locale);
  const shortDate = formatShortDate(locale);
  const { config } = rewards;

  const progress = progressToReward(rewards.available, config);
  const worth = valueOfPoints(rewards.available, config);

  /** Only the things that are actually true right now. */
  const notes = [
    ...(config.welcomePoints > 0 && !rewards.history.some((row) => row.kind === "welcome")
      ? [t("rewardsWelcomeNote", { points: n(config.welcomePoints) })]
      : []),
    ...(rewards.pending > 0 ? [t("rewardsPending", { points: n(rewards.pending) })] : []),
    ...(rewards.held > 0 ? [t("rewardsHeld", { points: n(rewards.held) })] : []),
  ];

  const referral = config.referralEnabled
    ? await (async () => {
        const code = await getReferralCode(user.id);
        if (!code) return null;
        const friendAmount = formatEuro(fromCents(config.referralFriendCents));
        // The link is read by the friend, who lands on the public site — it
        // follows the dashboard's language, not the account's order history.
        const link = referralLink(code, locale);
        return {
          code,
          link,
          friendAmount,
          shareText: referralShareText(code, friendAmount, locale),
          stats: await referralStats(user.id),
          tracks: await referralTracks(user.id),
        };
      })().catch(() => null)
    : null;

  return (
    <div className="space-y-6">
      <PageHeading title={t("rewardsTitle")} subtitle={t("rewardsSubtitle")} />

      <PointsHero
        label={t("rewardsBalanceLabel")}
        points={n(rewards.available)}
        worth={worth > 0 ? t("statPointsWorth", { amount: formatEuro(fromCents(worth)) }) : null}
        progress={progress.fraction}
        progressLabel={
          progress.canRedeem
            ? t("rewardsCanRedeem")
            : t("rewardsToGo", {
                points: n(progress.toGo),
                amount: formatEuro(fromCents(config.redeemStepCents)),
              })
        }
        linkLabel={t("orderCta")}
        href="/menu"
      />

      <RewardsCard
        rate={t("rewardsRate", {
          points: n(config.pointsPerEuro),
          step: n(config.redeemStepPoints),
          amount: formatEuro(fromCents(config.redeemStepCents)),
        })}
        howItWorks={t("rewardsHowItWorks")}
        howItWorksHref={`${sitePrefix(locale)}/rewards`}
        notes={notes}
        historyTitle={t("rewardsHistoryTitle")}
        showAll={t("rewardsShowAll")}
        historyEmpty={t("rewardsHistoryEmpty")}
        history={ledgerEntries(rewards.history, t, locale)}
      />

      {referral && (
        <div id="invite" className="scroll-mt-20">
          <ReferralCard
            link={referral.link}
            code={referral.code}
            shareText={referral.shareText}
            pending={referral.stats.pending}
            rewarded={referral.stats.rewarded}
            pointsEarned={n(referral.stats.pointsEarned)}
            tracks={referral.tracks}
            dates={referral.tracks.map((track) => shortDate(track.createdAt))}
            labels={{
              title: t("referralTitle"),
              text: t("referralText", {
                amount: referral.friendAmount,
                points: n(config.referralRewardPoints),
              }),
              linkLabel: t("referralLinkLabel"),
              copy: t("referralCopy"),
              copied: t("referralCopied"),
              codeLabel: t("referralCodeLabel"),
              share: t("referralShare"),
              onTheWay: t("referralOnTheWay"),
              ordered: t("referralOrdered"),
              pointsEarned: t("referralPointsEarned"),
              friendTemplate: t.raw("referralFriend") as string,
              status: {
                pending: t("referralStatusPending"),
                rewarded: t("referralStatusRewarded"),
                capped: t("referralStatusCapped"),
                cancelled: t("referralStatusCancelled"),
              },
            }}
          />
        </div>
      )}
    </div>
  );
}
