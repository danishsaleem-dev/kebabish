import type { Metadata } from "next";
import BrandLogo from "@/components/shared/BrandLogo";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, FileText, MapPin, UserPlus, LogIn, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getInvoiceNumber, getOrderByReference, localizeLineNames, syncPaymentStatus } from "@/lib/orders";
import { getPayment } from "@/lib/mollie";
import { isValidOrderToken } from "@/lib/order-token";
import { formatEuro, fromCents, vatIncludedCents } from "@/lib/money";
import { getPublicSettings } from "@/lib/admin/store";
import { listCreditNotesForCustomer } from "@/lib/refunds";
import { siteConfig } from "@/lib/site-config";
import { orderHasFeedback } from "@/lib/feedback/data";
import { validPaymentLinkUrl } from "@/lib/payment-link";
import { auth } from "@/lib/auth";
import { retryPaymentAction } from "@/app/[locale]/(site)/checkout/actions";
import ClearCartOnPaid from "@/components/cart/ClearCartOnPaid";
import AutoRefresh from "@/components/cart/AutoRefresh";
import ReceiptPrintButton from "@/components/cart/ReceiptPrintButton";

export const dynamic = "force-dynamic";

/** `?retry=` values the retry action can send back, each a `checkout.*` message. */
const RETRY_ERRORS = ["slotUnavailable", "slotClosed", "slotFull", "notAccepting", "failed"];

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return { title: t("completeTitle"), robots: { index: false, follow: false } };
}

export default async function CheckoutCompletePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ref?: string; t?: string; retry?: string }>;
}) {
  const { locale } = await params;
  const { ref, t: token, retry } = await searchParams;
  // The reference alone is guessable; the page shows personal details, so
  // it also needs the token that only the checkout redirect carries.
  if (!ref || !isValidOrderToken(ref, token)) notFound();

  const t = await getTranslations({ locale, namespace: "checkout" });
  const tCart = await getTranslations({ locale, namespace: "cart" });
  const order = await getOrderByReference(ref);
  if (!order) notFound();
  const receiptLines = await localizeLineNames(order.lines, locale);
  const creditNotes = await listCreditNotesForCustomer(order.id);
  const settings = await getPublicSettings();
  const vatRate = settings.vatRatePercent ?? null;
  const tFooter = await getTranslations({ locale, namespace: "footer" });
  const tFeedback = await getTranslations({ locale, namespace: "feedback" });
  // Once it has actually arrived — not before — invite them to say how it was,
  // unless they already have.
  const askForFeedback =
    order.status === "delivered" &&
    (order.paymentStatus === "paid" || order.paymentStatus === "refunded") &&
    !(await orderHasFeedback(order.id));

  // Reconcile here as well as in the webhook: the customer often lands back
  // before Mollie has called us, and locally there's no webhook at all.
  let paymentStatus = order.paymentStatus;
  if (order.molliePaymentId && paymentStatus === "open") {
    try {
      const payment = await getPayment(order.molliePaymentId);
      paymentStatus = await syncPaymentStatus(payment.id, payment.status, locale);
    } catch (error) {
      console.error("[checkout] could not reconcile payment:", error);
    }
  }

  // A refunded order was paid — it must not fall into the "still waiting" state.
  const refunded = paymentStatus === "refunded";
  const paid = paymentStatus === "paid" || refunded;
  const invoiceNumber = paid ? await getInvoiceNumber(order.reference) : null;
  const failed = ["failed", "expired", "canceled"].includes(paymentStatus);
  // Interim payment-link mode: unpaid, and the customer pays on Mollie's page.
  const linkPending = order.paymentMethod === "payment_link" && !paid && !failed;
  const paymentLinkUrl = validPaymentLinkUrl(settings.paymentLinkUrl);

  // A guest order (no customerId) placed while signed out is the one case
  // where it's worth offering to save the details just submitted — a
  // signed-in customer's order is already linked, so there's nothing to
  // offer them here.
  // Only a signed-in *customer* already has this order covered — staff
  // browsing their own test checkout, or a plain guest, should still see
  // the offer.
  const session = await auth();
  const offerAccount =
    paid && !order.customerId && session?.user?.role !== "customer";

  const placedAt = new Date(order.placedAt).toLocaleString(
    locale === "nl" ? "nl-NL" : "en-GB",
    { timeZone: "Europe/Amsterdam", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  // "YYYY-MM-DD" formatted via local Y/M/D parts, not a UTC parse — a
  // scheduled delivery *date* shouldn't drift a day depending on server
  // timezone, the same reasoning as DeliverySlotPicker's dateFromKey().
  const deliveryDateLabel = order.deliveryDate
    ? new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(
        (() => {
          const [y, m, d] = order.deliveryDate!.split("-").map(Number);
          return new Date(y, m - 1, d);
        })()
      )
    : null;

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center sm:px-6 sm:py-28">
      {(paid || order.paymentMethod === "payment_link") && <ClearCartOnPaid />}
      {/* Still waiting on the bank: look again every few seconds. Once paid,
          follow the order through the kitchen at a gentler pace. */}
      {!paid && !failed && <AutoRefresh intervalMs={linkPending ? 10000 : 4000} />}
      {paid && !["delivered", "cancelled"].includes(order.status) && (
        <AutoRefresh intervalMs={30000} />
      )}

      <span
        className={`print:hidden flex h-16 w-16 items-center justify-center rounded-full ${
          paid
            ? "bg-green-100 text-green-700"
            : failed
              ? "bg-red-100 text-red-700"
              : "bg-cream-300 text-charcoal-600"
        }`}
      >
        {paid ? (
          <CheckCircle2 size={30} />
        ) : failed ? (
          <XCircle size={30} />
        ) : (
          <Clock size={30} />
        )}
      </span>

      <h1 className="print:hidden mt-6 font-display text-3xl font-semibold text-charcoal-600 sm:text-4xl">
        {t("completeTitle")}
      </h1>

      <p className="print:hidden mt-4 text-base text-ink/70">
        {paid
          ? order.status === "cancelled"
            ? t("trackCancelled")
            : t("completePaid")
          : failed
            ? t("completeFailed")
            : linkPending
              ? t("payLinkPending")
              : t("completePending")}
      </p>

      {linkPending && (
        <div className="print:hidden mt-8 w-full max-w-md rounded-3xl border-2 border-ember-600/30 bg-cream-50 p-6 text-left">
          <p className="font-display text-lg font-semibold text-charcoal-600">{t("payLinkTitle")}</p>
          <ol className="mt-3 space-y-2 text-sm text-ink/80">
            <li>{t("payLinkStep1")}</li>
            <li>
              {t("payLinkStepAmount")}{" "}
              <strong className="tabular-nums">{formatEuro(fromCents(order.totalCents))}</strong>
            </li>
            <li>
              {t("payLinkStepDescription")}{" "}
              <strong className="select-all">{order.reference}</strong>
            </li>
          </ol>
          {paymentLinkUrl && (
            <a
              href={paymentLinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex w-full items-center justify-center rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              {t("payLinkButton", { amount: formatEuro(fromCents(order.totalCents)) })}
            </a>
          )}
          <p className="mt-4 text-xs text-ink/60">{t("payLinkAfter")}</p>
        </div>
      )}

      {paid && order.status !== "cancelled" && (
        <OrderProgress status={order.status} refunded={refunded} t={t} />
      )}

      {askForFeedback && (
        <div className="print:hidden mt-8 w-full max-w-md rounded-3xl border-2 border-ember-600/30 bg-cream-50 p-6 text-center">
          <p className="font-display text-lg font-semibold text-charcoal-600">
            {tFeedback("prompt.title")}
          </p>
          <p className="mt-1.5 text-sm text-ink/65">{tFeedback("prompt.text")}</p>
          <Link
            href={`/feedback?order=${encodeURIComponent(order.reference)}&t=${token ?? ""}&src=confirmation`}
            className="mt-4 inline-flex items-center justify-center rounded-full bg-ember-600 px-7 py-3 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            {tFeedback("prompt.cta")}
          </Link>
        </div>
      )}

      {creditNotes.length > 0 && (
        <ul className="print:hidden mt-6 w-full max-w-md space-y-2 text-sm">
          {creditNotes.map((n) => (
            <li
              key={n.number}
              className="flex items-center justify-between gap-3 rounded-2xl border border-charcoal-600/12 bg-cream-50 px-4 py-3"
            >
              <span className="text-left text-ink/75">
                {t("creditNoteLine", { amount: formatEuro(fromCents(n.amountCents)) })}
              </span>
              <a
                href={`/api/credit-note?ref=${encodeURIComponent(order.reference)}&t=${token ?? ""}&n=${encodeURIComponent(n.number)}&download=1`}
                className="inline-flex shrink-0 items-center gap-1.5 font-semibold text-charcoal-600 underline underline-offset-2 hover:text-ember-600"
              >
                <FileText size={14} aria-hidden="true" />
                {n.number}
              </a>
            </li>
          ))}
        </ul>
      )}

      {paid && order.status !== "cancelled" && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          <a
            href={`/api/invoice?ref=${encodeURIComponent(order.reference)}&t=${token ?? ""}&download=1`}
            className="print:hidden inline-flex items-center gap-2 rounded-full bg-ember-600 px-6 py-3 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
          >
            <FileText size={16} aria-hidden="true" />
            {t("invoiceDownload")}
          </a>
          <ReceiptPrintButton label={t("receiptDownload")} />
        </div>
      )}

      {failed && (
        <form action={retryPaymentAction} className="print:hidden mt-6 flex flex-col items-center gap-3">
          <input type="hidden" name="ref" value={ref} />
          <input type="hidden" name="t" value={token ?? ""} />
          <input type="hidden" name="locale" value={locale} />
          {retry && RETRY_ERRORS.includes(retry) && (
            <p role="alert" className="rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-800">
              {t(retry)}
            </p>
          )}
          <button
            type="submit"
            className="rounded-full bg-ember-600 px-7 py-3 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-700"
          >
            {t("retryPay")}
          </button>
        </form>
      )}

      {/* ---- receipt ------------------------------------------------------ */}
      <div className="mt-10 w-full rounded-3xl border border-charcoal-600/12 bg-cream-50 p-6 text-left sm:p-8 print:rounded-none print:border-0 print:bg-white print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-charcoal-600/10 pb-6">
          <BrandLogo
            src="/logo/Kebabish-light.png"
            alt={siteConfig.brandName}
            width={300}
            height={225}
            className="h-12 w-auto"
          />
          <div className="text-right">
            <p className="font-display text-lg font-semibold text-charcoal-600">
              {t("completeReference", { reference: order.reference })}
            </p>
            {invoiceNumber && (
              <p className="mt-0.5 text-xs font-medium text-ink/65">
                {t("receiptInvoiceNumber")} {invoiceNumber}
              </p>
            )}
            <p className="mt-0.5 text-xs text-ink/55">
              {t("receiptDate")} {placedAt}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-ember-600">
            {t("receiptItems")}
          </p>
          <ul className="mt-3 space-y-3 text-sm">
            {receiptLines.map((line, i) => (
              <li key={i} className="flex justify-between gap-3">
                <span className="text-ink/75">
                  {line.quantity}× {line.name}
                  {line.options.length > 0 && (
                    <span className="block text-ink/50">
                      {line.options.map((o) => o.optionLabel).join(", ")}
                    </span>
                  )}
                  {line.instructions && (
                    <span className="block italic text-ink/45">
                      {line.instructions}
                    </span>
                  )}
                  {line.replaces && (
                    <span className="block text-ink/50">{t("lineReplaces", { name: line.replaces })}</span>
                  )}
                  {line.listUnitPriceCents != null &&
                    line.listUnitPriceCents * line.quantity > line.lineTotalCents && (
                      <span className="block font-medium text-ember-700">
                        {t("lineRegularPrice", {
                          regular: formatEuro(fromCents(line.listUnitPriceCents)),
                          saved: formatEuro(
                            fromCents(line.listUnitPriceCents * line.quantity - line.lineTotalCents)
                          ),
                        })}
                      </span>
                    )}
                </span>
                <span className="shrink-0 tabular-nums text-charcoal-600">
                  {formatEuro(fromCents(line.lineTotalCents))}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <dl className="mt-6 space-y-2 border-t border-charcoal-600/10 pt-4 text-sm">
          <div className="flex justify-between">
            <dt className="text-ink/65">{tCart("subtotal")}</dt>
            <dd className="tabular-nums text-charcoal-600">
              {formatEuro(fromCents(order.subtotalCents))}
            </dd>
          </div>
          {order.discountCents > 0 && (
            <div className="flex justify-between">
              <dt className="text-ink/65">
                {tCart("discount")}
                {order.promoCode ? ` (${order.promoCode})` : ""}
              </dt>
              <dd className="tabular-nums text-ember-600">
                −{formatEuro(fromCents(order.discountCents))}
              </dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-ink/65">{tCart("deliveryFee")}</dt>
            <dd className="tabular-nums text-charcoal-600">
              {order.deliveryFeeCents === 0
                ? tCart("free")
                : formatEuro(fromCents(order.deliveryFeeCents))}
            </dd>
          </div>
        </dl>

        <div className="mt-3 flex justify-between border-t border-charcoal-600/10 pt-3 font-display text-base font-semibold text-charcoal-600">
          <span>{tCart("total")}</span>
          <span className="tabular-nums">{formatEuro(fromCents(order.totalCents))}</span>
        </div>
        {vatRate != null && (
          <p className="mt-1 flex justify-between text-xs text-ink/55">
            <span>{t("receiptVat", { rate: vatRate })}</span>
            <span className="tabular-nums">
              {formatEuro(fromCents(vatIncludedCents(order.totalCents, vatRate)))}
            </span>
          </p>
        )}

        {deliveryDateLabel && order.deliverySlotStart && (
          <div className="mt-6 flex items-start gap-2 border-t border-charcoal-600/10 pt-4 text-sm text-ink/70">
            <Clock size={15} className="mt-0.5 shrink-0 text-ember-600/70" />
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink/45">
                {t("receiptDeliveryTime")}
              </p>
              <p className="mt-0.5 capitalize">
                {deliveryDateLabel}, {order.deliverySlotStart}–{order.deliverySlotEnd}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2 border-t border-charcoal-600/10 pt-4 text-sm text-ink/70">
          <MapPin size={15} className="mt-0.5 shrink-0 text-ember-600/70" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink/45">
              {t("receiptDeliverTo")}
            </p>
            <p className="mt-0.5">
              {order.addressStreet}, {order.addressPostcode} {order.addressCity}
            </p>
          </div>
        </div>

        <p className="mt-6 border-t border-charcoal-600/10 pt-4 text-xs text-ink/50">
          {siteConfig.brandName} · {siteConfig.address.street}, {siteConfig.address.postalCode}{" "}
          {siteConfig.address.city} · {tFooter("kvk")} {siteConfig.kvkNumber}
          {settings.vatNumber ? ` · ${tFooter("vatId")} ${settings.vatNumber}` : ""}
        </p>

        {order.notes && (
          <div className="mt-4 text-sm text-ink/70">
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-ink/45">
              {t("receiptNotes")}
            </p>
            <p className="mt-0.5">{order.notes}</p>
          </div>
        )}
      </div>

      {offerAccount && (
        <div className="print:hidden mt-8 w-full rounded-3xl bg-charcoal-900 p-6 text-left text-cream-100 sm:p-8">
          <h2 className="font-display text-lg font-semibold text-cream-50">
            {t("createAccountTitle")}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-cream-200/70">
            {t("createAccountText")}
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Link
              href={{
                pathname: "/signup",
                query: {
                  name: order.customerName,
                  email: order.customerEmail,
                  phone: order.customerPhone,
                },
              }}
              className="inline-flex items-center justify-center gap-2 rounded-full bg-ember-600 px-6 py-3 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              <UserPlus size={16} />
              {t("createAccountCta")}
            </Link>
            <Link
              href={{ pathname: "/login", query: { email: order.customerEmail } }}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-cream-100/25 px-6 py-3 font-display text-sm font-semibold text-cream-100 transition-colors hover:bg-cream-100/10"
            >
              <LogIn size={16} />
              {t("loginPrompt")} {t("loginCta")}
            </Link>
          </div>
        </div>
      )}

      <Link
        href="/menu"
        className="print:hidden mt-8 rounded-full bg-charcoal-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-100 transition-colors hover:bg-ember-600"
      >
        {t("backToMenu")}
      </Link>
    </div>
  );
}

/** The customer-facing "where is my order" tracker. */
function OrderProgress({
  status,
  refunded,
  t,
}: {
  status: string;
  refunded: boolean;
  t: (key: string) => string;
}) {
  // "ready" is the kitchen's own optional step — to the customer it is
  // still "being prepared".
  const steps = [
    { key: "new", label: t("trackReceived") },
    { key: "preparing", label: t("trackPreparing") },
    { key: "on_the_way", label: t("trackOnTheWay") },
    { key: "delivered", label: t("trackDelivered") },
  ];
  // An order accepted for a later day ("scheduled") is still waiting on its day, so it
  // reads as received — the confirmation email says when it will be made.
  const position = status === "ready" ? 1 : Math.max(steps.findIndex((s) => s.key === status), 0);

  return (
    <>
    {refunded && (
      <p className="print:hidden mt-6 rounded-2xl bg-cream-300 px-5 py-3 text-sm font-medium text-charcoal-600">
        {t("trackRefunded")}
      </p>
    )}
    <ol className="print:hidden mt-8 flex w-full max-w-md items-start gap-2" aria-label={t("trackTitle")}>
      {steps.map((step, i) => {
        const done = i <= position;
        return (
          <li key={step.key} className="flex-1 text-center">
            <div className={`h-1.5 rounded-full ${done ? "bg-ember-600" : "bg-charcoal-600/12"}`} />
            <p className={`mt-2 text-xs ${done ? "font-semibold text-charcoal-600" : "text-ink/45"}`}>
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
    </>
  );
}
