import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getReviews } from "@/lib/content/site";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import ReviewWall from "@/components/home/ReviewWall";

/**
 * What customers said, from Website content → Reviews in /admin — real quotes Danish
 * supplies, shown exactly as written, never invented copy.
 *
 * The section is absent, not empty, while that list is: a testimonial block with
 * placeholder praise is the one thing on a restaurant page that destroys trust
 * outright, and Google's review-snippet guidelines penalise it. It switches itself on
 * the moment real entries land, with no code change — the same arrangement
 * `StructuredData.tsx` uses for aggregateRating.
 *
 * The heading carries a summary (the average of the ratings shown, and how many there
 * are), and the quotes themselves are a swipeable deck (`ReviewWall`) that runs the
 * full width of the screen.
 */
export default async function Testimonials({ locale }: { locale: string }) {
  const reviews = await getReviews();
  if (reviews.length === 0) return null;

  const t = await getTranslations({ locale });
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const averageLabel = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);

  return (
    <section className="relative overflow-hidden bg-charcoal-900 py-20 text-cream-100 sm:py-28 lg:py-32">
      {/* Ember bloom low-left and a softer one top-right, so the band is lit
          rather than reading as a flat dark slab. */}
      <div className="absolute inset-0 bg-[radial-gradient(65%_55%_at_12%_100%,rgba(169,80,38,0.26),transparent_70%),radial-gradient(40%_40%_at_90%_0%,rgba(169,80,38,0.16),transparent_70%)]" />
      <div className="grain absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <SectionEyebrow tone="light">{t("home.reviewsEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-100 sm:text-4xl lg:text-[2.75rem]"
            >
              <MaskedWords text={t("home.reviewsTitle")} />
            </h2>
          </div>

          <div data-reveal className="flex items-center gap-5">
            <div className="flex items-center gap-4 rounded-2xl border border-cream-200/12 bg-cream-50/[0.04] px-5 py-3.5">
              <span className="font-display text-4xl font-bold text-cream-50">{averageLabel}</span>
              <span>
                <span
                  className="flex gap-0.5 text-ember-400"
                  role="img"
                  aria-label={t("home.reviewsRating", { rating: averageLabel })}
                >
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star
                      key={i}
                      size={15}
                      aria-hidden="true"
                      className={i < Math.round(average) ? "fill-current" : "text-cream-200/25"}
                    />
                  ))}
                </span>
                <span className="mt-1 block text-xs text-cream-200/60">
                  {t("home.reviewsBasedOn", { count: reviews.length })}
                </span>
              </span>
            </div>
            <Link
              href="/reviews"
              className="link-underline hidden items-center gap-2 font-display text-sm font-semibold text-ember-400 sm:inline-flex"
            >
              {t("home.reviewsCta")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div data-reveal className="relative z-10 mt-10 sm:mt-12">
        <ReviewWall reviews={reviews} />
      </div>

      <div className="relative z-10 mt-6 flex justify-center sm:hidden">
        <Link
          href="/reviews"
          className="inline-flex items-center gap-2 font-display text-sm font-semibold text-ember-400"
        >
          {t("home.reviewsCta")}
          <ArrowUpRight size={16} />
        </Link>
      </div>
    </section>
  );
}
