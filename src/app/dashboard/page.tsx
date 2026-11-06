import { redirect } from "next/navigation";
import Link from "next/link";
import {
  ArrowRight,
  MessageSquareHeart,
  ReceiptText,
  ShoppingBag,
  Star,
  Truck,
  Users,
} from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { formatEuro, fromCents } from "@/lib/money";
import { orderIdsWithFeedback } from "@/lib/feedback/data";
import { localizeLineNames, type OrderSummary } from "@/lib/orders";
import { pointsByOrder } from "@/lib/rewards";
import { progressToReward, valueOfPoints } from "@/lib/rewards-math";
import { getReferralCode, referralStats } from "@/lib/referrals";
import { accountLocale } from "@/lib/account-page";
import {
  customerAccount,
  customerOrders,
  customerProfile,
  customerRewards,
  liveOrders,
} from "@/lib/account-data";
import {
  feedbackHref,
  formatDeliveryWindow,
  formatLongDate,
  formatNumber,
  invoiceHref,
  ledgerHeadline,
  orderCardLines,
  orderDetailsHref,
  orderPointsNote,
  orderStatusPill,
  reorderHref,
  wasPaid,
} from "@/lib/account-view";
import AutoRefresh from "@/components/cart/AutoRefresh";
import { ConfirmAccountBanner } from "@/components/dashboard/AccountCards";
import OrderCard from "@/components/dashboard/OrderCard";
import OrderTracker, { trackerPosition } from "@/components/dashboard/OrderTracker";
import PointsHero from "@/components/dashboard/PointsHero";
import PointsUpdates from "@/components/dashboard/PointsUpdates";
import QuickActions, { type QuickAction } from "@/components/dashboard/QuickActions";
import {
  EmptyState,
  LinkButton,
  PageHeading,
  SectionHeading,
  StatTile,
} from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

/** Within a fortnight — after that it is too long ago to ask how an order was. */
function placedRecently(placedAt: string): boolean {
  return Date.now() - Date.parse(placedAt) < 14 * 24 * 60 * 60 * 1000;
}

/** Paid and still in flight: the same rule the navigation badge counts. */
function isLive(order: OrderSummary): boolean {
  return order.paymentStatus === "paid" && !["delivered", "cancelled"].includes(order.status);
}

export default async function AccountOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: justPlaced } = await searchParams;
  const session = await auth();
  // The layout already redirects an unauthenticated request; this is a
  // defensive fallback so a null session can't crash the page instead.
  if (!session?.user) redirect("/login");
  const user = session.user;

  const locale = await accountLocale(user.id);
  const t = await getTranslations({ locale, namespace: "account" });
  const n = formatNumber(locale);
  const longDate = formatLongDate(locale);

  const [orders, profile, account, rewards] = await Promise.all([
    customerOrders(user.id),
    customerProfile(user.id),
    customerAccount(user.id),
    customerRewards(user.id),
  ]);

  const live = liveOrders(orders);
  const past = orders.filter((order) => !isLive(order));
  const delivered = orders.filter((order) => order.status === "delivered");
  // No password yet = the account was made when an order was paid and is waiting
  // to be confirmed from the email (see customers/account-rules.ts).
  const passwordless = account?.passwordless ?? false;

  const orderPoints = rewards ? await pointsByOrder(user.id).catch(() => new Map()) : new Map();

  /** The invite programme, with the amounts already formatted. Null while it's off. */
  const referral = rewards?.config.referralEnabled
    ? await (async () => {
        const code = await getReferralCode(user.id);
        if (!code) return null;
        return {
          friendAmount: formatEuro(fromCents(rewards.config.referralFriendCents)),
          stats: await referralStats(user.id),
        };
      })().catch(() => null)
    : null;

  // The most recent delivered order that hasn't been rated yet.
  const rated = await orderIdsWithFeedback(delivered.map((order) => order.id));
  const toRate = delivered.find((order) => !rated.has(order.id) && placedRecently(order.placedAt));

  // Dish names follow the dashboard's language where an English name exists,
  // the same way the customer's own receipt and emails do.
  const liveCards = await Promise.all(
    live.map(async (order) => ({
      order,
      items: (await localizeLineNames(order.lines, locale))
        .map((line) => `${line.quantity}× ${line.name}`)
        .join(", "),
    }))
  );

  const latest = past[0] ?? null;
  const latestLines = latest ? await localizeLineNames(latest.lines, locale) : [];
  const progress = rewards ? progressToReward(rewards.available, rewards.config) : null;
  const worth = rewards ? valueOfPoints(rewards.available, rewards.config) : 0;

  const actions: QuickAction[] = [
    { key: "menu", href: "/menu", title: t("quickMenu"), note: t("quickMenuNote") },
    ...(latest && wasPaid(latest)
      ? [
          {
            key: "reorder" as const,
            href: reorderHref(latest),
            title: t("quickReorder"),
            note: t("quickReorderNote"),
          },
        ]
      : []),
    ...(rewards
      ? [
          {
            key: "rewards" as const,
            href: "/dashboard/rewards",
            title: t("quickRewards"),
            note: t("quickRewardsNote"),
          },
        ]
      : []),
    ...(referral
      ? [
          {
            key: "invite" as const,
            href: "/dashboard/rewards#invite",
            title: t("quickInvite"),
            note: t("quickInviteNote", { amount: referral.friendAmount }),
          },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title={t(orders.length <= 1 && passwordless ? "welcome" : "welcomeBack", {
          name: profile?.name || user.name || user.email,
        })}
        subtitle={t("homeSubtitle")}
      />

      {passwordless && (
        <ConfirmAccountBanner
          locale={locale}
          title={t("confirmTitle")}
          text={t("confirmText", { email: user.email })}
          resend={t("confirmResend")}
        />
      )}

      {/* ------------------------------------------- what is happening now */}
      {liveCards.length > 0 ? (
        <div className="space-y-4">
          {/* The page refreshes itself while an order is in flight, so the
              tracker keeps up with the kitchen without the customer reloading. */}
          <AutoRefresh intervalMs={30_000} />
          {liveCards.map(({ order, items }) => {
            const at = trackerPosition(order.status);
            return (
              <OrderTracker
                key={order.reference}
                reference={order.reference}
                total={formatEuro(fromCents(order.totalCents))}
                at={at}
                when={formatDeliveryWindow(locale, order)}
                items={items}
                justPlaced={order.reference === justPlaced}
                detailsHref={orderDetailsHref(order)}
                labels={{
                  eyebrow: t("trackerYourOrder"),
                  justPlaced: t("trackerJustPlaced"),
                  steps: [
                    t("stepReceived"),
                    t("stepPreparing"),
                    t("stepOnTheWay"),
                    t("stepDelivered"),
                  ],
                  message:
                    order.status === "scheduled"
                      ? t("trackerLater")
                      : at === 0
                        ? t("trackerReceived")
                        : at === 1
                          ? t("trackerPreparing")
                          : t("trackerOnTheWay"),
                  details: t("trackerDetails"),
                }}
              />
            );
          })}
        </div>
      ) : (
        orders.length > 0 && (
          <EmptyState
            icon={<Truck size={22} aria-hidden="true" />}
            title={t("noLiveTitle")}
            text={t("noLiveText")}
            action={
              <LinkButton href="/menu">
                <ShoppingBag size={15} aria-hidden="true" />
                {t("orderCta")}
              </LinkButton>
            }
          />
        )
      )}

      {/* ------------------------------------------------------- the points */}
      {rewards && progress && (
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
                  amount: formatEuro(fromCents(rewards.config.redeemStepCents)),
                })
          }
          linkLabel={t("navRewards")}
          href="/dashboard/rewards"
        />
      )}

      {orders.length > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <StatTile
            label={t("statOrders")}
            value={String(orders.length)}
            note={
              delivered.length > 0
                ? t("statOrdersCount", { count: delivered.length })
                : t("statOrdersEmpty")
            }
            icon={<ReceiptText size={13} aria-hidden="true" />}
          />
          {referral && (
            <StatTile
              label={t("statFriends")}
              value={String(referral.stats.rewarded + referral.stats.pending)}
              note={t("statFriendsOrdered", { count: referral.stats.rewarded })}
              icon={<Users size={13} aria-hidden="true" />}
            />
          )}
        </div>
      )}

      {/* ------------------------------------------------- what to do next */}
      <div className="space-y-3">
        <SectionHeading title={t("quickTitle")} />
        <QuickActions actions={actions} />
      </div>

      {/* --------------------------------------------- how was your order? */}
      {toRate && (
        <section className="rounded-2xl border border-ember-600/30 bg-ember-600/5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
                <MessageSquareHeart size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-base font-semibold text-heading">
                  {t("feedbackTitle", { reference: toRate.reference })}
                </h2>
                <p className="mt-0.5 text-sm text-muted">{t("feedbackText")}</p>
              </div>
            </div>
            <LinkButton href={feedbackHref(toRate, "dashboard")}>
              <Star size={15} aria-hidden="true" />
              {t("orderFeedback")}
            </LinkButton>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------ what is new */}
      {rewards && rewards.history.length > 0 && (
        <PointsUpdates
          rows={rewards.history.map((row) => ({
            id: row.id,
            createdAt: row.createdAt,
            headline: ledgerHeadline(row, t, n),
          }))}
          title={t("updatesTitle")}
          // The count is only known in the browser, so the template crosses
          // the boundary and is filled in there.
          newTemplate={t.raw("updatesNew") as string}
        />
      )}

      {/* -------------------------------------------------- the last order */}
      {latest ? (
        <div className="space-y-3">
          <SectionHeading
            title={t("lastOrderTitle")}
            action={
              <Link
                href="/dashboard/orders"
                className="inline-flex items-center gap-1 text-sm font-semibold text-ember-700 hover:text-ember-600"
              >
                {t("allOrders")}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            }
          />
          <OrderCard
            reference={latest.reference}
            date={longDate(latest.placedAt)}
            status={orderStatusPill(latest, t)}
            total={formatEuro(fromCents(latest.totalCents))}
            lines={orderCardLines(latestLines)}
            pointsNote={
              rewards
                ? orderPointsNote(
                    orderPoints.get(latest.id)?.used ?? 0,
                    orderPoints.get(latest.id)?.earned ?? 0,
                    // A finished order has nothing more coming.
                    0,
                    t,
                    n
                  )
                : null
            }
            creditNotes={[]}
            reorderHref={wasPaid(latest) ? reorderHref(latest) : null}
            invoiceHref={wasPaid(latest) ? invoiceHref(latest) : null}
            feedbackHref={
              latest.status === "delivered" && !rated.has(latest.id)
                ? feedbackHref(latest, "dashboard")
                : null
            }
            feedbackSent={latest.status === "delivered" && rated.has(latest.id)}
            when={formatDeliveryWindow(locale, latest)}
            address={`${latest.addressStreet}, ${latest.addressPostcode} ${latest.addressCity}`}
            labels={{
              showItems: t("orderShowItems"),
              itemCount: t("itemCount", { count: latest.lines.length }),
              reorder: t("orderReorder"),
              invoice: t("orderInvoice"),
              feedback: t("orderFeedback"),
              feedbackSent: t("orderFeedbackSent"),
              address: t("orderAddress"),
              total: t("orderTotal"),
            }}
          />
        </div>
      ) : (
        orders.length === 0 && (
          <EmptyState
            icon={<ShoppingBag size={22} aria-hidden="true" />}
            title={t("ordersEmptyTitle")}
            text={t("ordersEmptyText")}
            action={
              <LinkButton href="/menu">
                <ShoppingBag size={15} aria-hidden="true" />
                {t("quickMenu")}
              </LinkButton>
            }
          />
        )
      )}
    </div>
  );
}
