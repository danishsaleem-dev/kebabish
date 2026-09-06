import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Star, MessageSquareHeart, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { reviews } from "@/lib/reviews-data";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "reviews" });
  return { title: t("title"), description: t("intro") };
}

export default async function ReviewsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "reviews" });

  return (
    <div className="bg-cream-200">
      <div className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-600">
            {t("title")}
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-tight text-charcoal-600 sm:text-5xl">
            {t("intro")}
          </h1>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        {reviews.length > 0 ? (
          <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((review, i) => (
              <li
                key={i}
                className="rounded-3xl border border-charcoal-600/10 bg-cream-50 p-7"
              >
                <div className="flex items-center gap-1 text-ember-600">
                  {Array.from({ length: 5 }).map((_, star) => (
                    <Star
                      key={star}
                      size={16}
                      fill={star < review.rating ? "currentColor" : "none"}
                      strokeWidth={1.5}
                    />
                  ))}
                </div>
                <p className="mt-4 text-pretty text-[0.95rem] leading-relaxed text-ink/80">
                  “{review.text}”
                </p>
                <p className="mt-4 font-display text-sm font-semibold text-charcoal-600">
                  {review.name}
                  {review.source ? (
                    <span className="ml-1.5 font-sans text-xs font-normal text-ink/45">
                      · {review.source}
                    </span>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mx-auto flex max-w-lg flex-col items-center rounded-3xl border border-dashed border-charcoal-600/20 bg-cream-50 px-8 py-16 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
              <MessageSquareHeart size={24} />
            </span>
            <h2 className="mt-5 font-display text-xl font-semibold text-charcoal-600">
              {t("emptyTitle")}
            </h2>
            <p className="mt-2 text-pretty text-[0.95rem] leading-relaxed text-ink/65">
              {t("emptyText")}
            </p>
          </div>
        )}
      </div>

      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div className="rounded-[2rem] bg-charcoal-900 px-8 py-14 text-center sm:px-16 sm:py-20">
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-cream-200/75 sm:text-lg">
            {t("ctaText")}
          </p>
          <div className="mt-8 flex justify-center">
            <Link
              href="/menu"
              className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-ember-600 px-8 py-4 text-sm font-semibold text-cream-50 shadow-lg shadow-ember-800/30 transition-transform duration-300 hover:-translate-y-0.5"
            >
              <UtensilsCrossed
                size={18}
                className="transition-transform duration-300 group-hover:rotate-12"
              />
              {t("ctaMenu")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
