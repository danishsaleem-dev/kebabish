import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicMenu } from "@/lib/public-menu";
import { getPublicSettings } from "@/lib/admin/store";
import { getOrderByReference, localizeLineNames } from "@/lib/orders";
import { isValidOrderToken } from "@/lib/order-token";
import { orderHasFeedback } from "@/lib/feedback/data";
import { parseSource } from "@/lib/feedback/questions";
import { validReviewUrl } from "@/lib/feedback/review-url";
import { pageMetadata } from "@/lib/seo";
import Testimonials from "@/components/home/Testimonials";
import FeedbackForm from "@/components/feedback/FeedbackForm";

// The form changes with the query string (which order, where from), so this
// page can't be prerendered.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "feedback" });
  // A form, not something anyone searches for — and with an order link in the
  // URL it must never be indexed. It still gets its own canonical and hreflang.
  return pageMetadata({
    locale,
    path: "/feedback",
    title: t("metaTitle"),
    description: t("metaDescription"),
    noindex: true,
  });
}

export default async function FeedbackPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ order?: string; t?: string; src?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { order: reference, t: token, src } = await searchParams;

  const t = await getTranslations({ locale, namespace: "feedback" });
  const settings = await getPublicSettings();

  // The order link: a reference *and* its signed token. Anything else —
  // missing, wrong, for an unpaid order — quietly becomes general feedback, so
  // the page never confirms or denies that a reference exists.
  let order: {
    reference: string;
    token: string;
    name: string;
    email: string;
    dishes: { slug: string; name: string }[];
  } | null = null;
  let alreadyGiven = false;

  if (reference && isValidOrderToken(reference, token)) {
    const found = await getOrderByReference(reference);
    if (found && (found.paymentStatus === "paid" || found.paymentStatus === "refunded")) {
      alreadyGiven = await orderHasFeedback(found.id);
      // Names in the reader's language where an English one exists; the saved
      // feedback always snapshots the default (Dutch) name, like order lines do.
      const lines = await localizeLineNames(found.lines, locale);
      const seen = new Set<string>();
      const dishes = lines.flatMap((line) => {
        if (seen.has(line.slug)) return [];
        seen.add(line.slug);
        return [{ slug: line.slug, name: line.name }];
      });
      order = {
        reference: found.reference,
        token: token as string,
        name: found.customerName,
        email: found.customerEmail,
        dishes,
      };
    }
  }

  // Only needed to pick dishes when there's no order to read them from.
  const menu = order
    ? []
    : (await getPublicMenu(locale)).map((category) => ({
        id: category.id,
        label: category.label,
        items: category.items.map((item) => ({ slug: item.slug, name: item.name })),
      }));

  return (
    <div className="bg-cream-200">
      <div className="mx-auto max-w-2xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-600">
            {t("eyebrow")}
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-tight text-charcoal-600 sm:text-5xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-4 max-w-lg text-pretty text-base text-ink/70">{t("intro")}</p>
          {order && (
            <p className="mt-3 inline-block rounded-full bg-charcoal-600/8 px-4 py-1.5 text-sm font-semibold text-charcoal-600">
              {t("forOrder", { reference: order.reference })}
            </p>
          )}
        </div>

        <div className="mt-10">
          {alreadyGiven ? (
            <div className="rounded-3xl border border-charcoal-600/12 bg-cream-50 p-8 text-center sm:p-12">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-green-700">
                <CheckCircle2 size={30} />
              </span>
              <h2 className="mt-6 font-display text-2xl font-semibold text-charcoal-600">
                {t("already.title")}
              </h2>
              <p className="mx-auto mt-3 max-w-md text-base text-ink/70">{t("already.text")}</p>
              <Link
                href="/menu"
                className="mt-8 inline-block rounded-full bg-charcoal-600 px-6 py-3 font-display text-sm font-semibold text-cream-100 transition-colors hover:bg-ember-600"
              >
                {t("thanks.menu")}
              </Link>
            </div>
          ) : (
            <FeedbackForm
              locale={locale}
              source={parseSource(src)}
              order={order}
              menu={menu}
              reviewUrl={validReviewUrl(settings.googleReviewUrl)}
            />
          )}
        </div>
      </div>

      {/* What others said — renders nothing until there are reviews. */}
      <Testimonials locale={locale} compact />
    </div>
  );
}
