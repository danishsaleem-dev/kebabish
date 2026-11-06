import { redirect } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { formatEuro, fromCents } from "@/lib/money";
import { localizeLineNames } from "@/lib/orders";
import { orderIdsWithFeedback } from "@/lib/feedback/data";
import { listCreditNotesForCustomer } from "@/lib/refunds";
import { pointsByOrder } from "@/lib/rewards";
import { accountLocale } from "@/lib/account-page";
import { customerOrders, customerRewards, liveOrders } from "@/lib/account-data";
import {
  creditNoteLinks,
  feedbackHref,
  formatDeliveryWindow,
  formatLongDate,
  formatNumber,
  invoiceHref,
  orderCardLines,
  orderDetailsHref,
  orderPointsNote,
  orderStatusPill,
  reorderHref,
  wasPaid,
} from "@/lib/account-view";
import AutoRefresh from "@/components/cart/AutoRefresh";
import OrderCard from "@/components/dashboard/OrderCard";
import OrderTracker, { trackerPosition } from "@/components/dashboard/OrderTracker";
import { EmptyState, LinkButton, PageHeading, SectionHeading } from "@/components/dashboard/ui";

export const dynamic = "force-dynamic";

/**
 * Every order the customer has, newest first: the ones in flight get the
 * live tracker, the rest are cards with their dishes folded away.
 */
export default async function AccountOrdersPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const user = session.user;

  const locale = await accountLocale(user.id);
  const t = await getTranslations({ locale, namespace: "account" });
  const n = formatNumber(locale);
  const longDate = formatLongDate(locale);

  const [orders, rewards] = await Promise.all([
    customerOrders(user.id),
    customerRewards(user.id),
  ]);

  const live = liveOrders(orders);
  const liveRefs = new Set(live.map((order) => order.reference));
  const past = orders.filter((order) => !liveRefs.has(order.reference));

  const rated = await orderIdsWithFeedback(
    orders.filter((order) => order.status === "delivered").map((order) => order.id)
  );
  const orderPoints = rewards ? await pointsByOrder(user.id).catch(() => new Map()) : new Map();

  // Credit notes only exist for an order money has come back on, so only
  // those are looked up.
  const creditNotes = new Map(
    await Promise.all(
      orders
        .filter((order) => order.refundedCents > 0 || order.paymentStatus === "refunded")
        .map(
          async (order) =>
            [order.reference, await listCreditNotesForCustomer(order.id).catch(() => [])] as const
        )
    )
  );

  const liveCards = await Promise.all(
    live.map(async (order) => ({
      order,
      items: (await localizeLineNames(order.lines, locale))
        .map((line) => `${line.quantity}× ${line.name}`)
        .join(", "),
    }))
  );

  const pastCards = await Promise.all(
    past.map(async (order) => ({
      order,
      lines: orderCardLines(await localizeLineNames(order.lines, locale)),
    }))
  );

  return (
    <div className="space-y-6">
      <PageHeading title={t("ordersTitle")} subtitle={t("ordersSubtitle")} />

      {orders.length === 0 && (
        <EmptyState
          icon={<ShoppingBag size={22} aria-hidden="true" />}
          title={t("ordersEmptyTitle")}
          text={t("ordersEmptyText")}
          action={
            <LinkButton href="/menu">
              <ShoppingBag size={15} aria-hidden="true" />
              {t("ordersEmptyCta")}
            </LinkButton>
          }
        />
      )}

      {liveCards.length > 0 && (
        <div className="space-y-3">
          <AutoRefresh intervalMs={30_000} />
          <SectionHeading title={t("ordersLive")} />
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
                justPlaced={false}
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
      )}

      {pastCards.length > 0 && (
        <div className="space-y-3">
          {liveCards.length > 0 && <SectionHeading title={t("ordersPast")} />}
          {pastCards.map(({ order, lines }) => {
            const points = orderPoints.get(order.id);
            return (
              <OrderCard
                key={order.reference}
                reference={order.reference}
                date={longDate(order.placedAt)}
                status={orderStatusPill(order, t)}
                total={formatEuro(fromCents(order.totalCents))}
                lines={lines}
                pointsNote={
                  rewards
                    ? // A finished order has nothing more coming — anything
                      // still in flight is shown by the tracker above.
                      orderPointsNote(points?.used ?? 0, points?.earned ?? 0, 0, t, n)
                    : null
                }
                creditNotes={creditNoteLinks(order, creditNotes.get(order.reference) ?? [], t)}
                reorderHref={wasPaid(order) ? reorderHref(order) : null}
                invoiceHref={wasPaid(order) ? invoiceHref(order) : null}
                feedbackHref={
                  order.status === "delivered" && !rated.has(order.id)
                    ? feedbackHref(order, "dashboard")
                    : null
                }
                feedbackSent={order.status === "delivered" && rated.has(order.id)}
                when={formatDeliveryWindow(locale, order)}
                address={`${order.addressStreet}, ${order.addressPostcode} ${order.addressCity}`}
                labels={{
                  showItems: t("orderShowItems"),
                  itemCount: t("itemCount", { count: order.lines.length }),
                  reorder: t("orderReorder"),
                  invoice: t("orderInvoice"),
                  feedback: t("orderFeedback"),
                  feedbackSent: t("orderFeedbackSent"),
                  address: t("orderAddress"),
                  total: t("orderTotal"),
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
