import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, MapPin, UserPlus, LogIn, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getOrderByReference, syncPaymentStatus } from "@/lib/orders";
import { getPayment } from "@/lib/mollie";
import { formatEuro, fromCents } from "@/lib/money";
import { siteConfig } from "@/lib/site-config";
import { auth } from "@/lib/auth";
import ClearCartOnPaid from "@/components/cart/ClearCartOnPaid";
import ReceiptPrintButton from "@/components/cart/ReceiptPrintButton";

export const dynamic = "force-dynamic";

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
  searchParams: Promise<{ ref?: string }>;
}) {
  const { locale } = await params;
  const { ref } = await searchParams;
  if (!ref) notFound();

  const t = await getTranslations({ locale, namespace: "checkout" });
  const tCart = await getTranslations({ locale, namespace: "cart" });
  const order = await getOrderByReference(ref);
  if (!order) notFound();

  // Reconcile here as well as in the webhook: the customer often lands back
  // before Mollie has called us, and locally there's no webhook at all.
  let paymentStatus = order.paymentStatus;
  if (order.molliePaymentId && paymentStatus === "open") {
    try {
      const payment = await getPayment(order.molliePaymentId);
      paymentStatus = await syncPaymentStatus(payment.id, payment.status);
    } catch (error) {
      console.error("[checkout] could not reconcile payment:", error);
    }
  }

  const paid = paymentStatus === "paid";
  const failed = ["failed", "expired", "canceled"].includes(paymentStatus);

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
    { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }
  );

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center sm:px-6 sm:py-28">
      {paid && <ClearCartOnPaid />}

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
          ? t("completePaid")
          : failed
            ? t("completeFailed")
            : t("completePending")}
      </p>

      {paid && (
        <div className="mt-6">
          <ReceiptPrintButton label={t("receiptDownload")} />
        </div>
      )}

      {/* ---- receipt ------------------------------------------------------ */}
      <div className="mt-10 w-full rounded-3xl border border-charcoal-600/12 bg-cream-50 p-6 text-left sm:p-8 print:rounded-none print:border-0 print:bg-white print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-charcoal-600/10 pb-6">
          <Image
            src="/logo/Kebabish-light.png"
            alt={siteConfig.brandName}
            width={440}
            height={330}
            className="h-12 w-auto"
          />
          <div className="text-right">
            <p className="font-display text-lg font-semibold text-charcoal-600">
              {t("completeReference", { reference: order.reference })}
            </p>
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
            {order.lines.map((line, i) => (
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
