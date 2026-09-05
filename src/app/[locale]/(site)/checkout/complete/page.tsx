import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getOrderByReference, syncPaymentStatus } from "@/lib/orders";
import { getPayment } from "@/lib/mollie";
import { formatEuro, fromCents } from "@/lib/money";
import ClearCartOnPaid from "@/components/cart/ClearCartOnPaid";

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-20 text-center sm:px-6 sm:py-28">
      {paid && <ClearCartOnPaid />}

      <span
        className={`flex h-16 w-16 items-center justify-center rounded-full ${
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

      <h1 className="mt-6 font-display text-3xl font-semibold text-charcoal-600 sm:text-4xl">
        {t("completeTitle")}
      </h1>

      <p className="mt-4 text-base text-ink/70">
        {paid
          ? t("completePaid")
          : failed
            ? t("completeFailed")
            : t("completePending")}
      </p>

      <p className="mt-2 font-display text-lg font-semibold text-charcoal-600">
        {t("completeReference", { reference: order.reference })}
      </p>

      <p className="mt-1 text-sm text-ink/55">
        {formatEuro(fromCents(order.totalCents))}
      </p>

      <Link
        href="/menu"
        className="mt-8 rounded-full bg-charcoal-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-100 transition-colors hover:bg-ember-600"
      >
        {t("backToMenu")}
      </Link>
    </div>
  );
}
