import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Quote, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getReviews } from "@/lib/content/site";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

/**
 * What customers said, from Website content → Reviews in /admin — real quotes Danish
 * supplies, never invented copy.
 *
 * The section is absent, not empty, while that list is: a testimonial block
 * with placeholder praise is the one thing on a restaurant page that destroys
 * trust outright, and Google's review-snippet guidelines penalise it. It
 * switches itself on the moment real entries land, with no code change — the
 * same arrangement `StructuredData.tsx` uses for aggregateRating.
 *
 * The layout adapts to how many there are: one quote gets the full width as a
 * pull quote, two sit side by side, three or more form a grid. So the first
 * few reviews look deliberate rather than like a grid missing its other cards.
 */
export default async function Testimonials({ locale }: { locale: string }) {
  const reviews = await getReviews();
  if (reviews.length === 0) return null;

  const t = await getTranslations({ locale });
  const single = reviews.length === 1;

  return (
    <section className="relative overflow-hidden bg-charcoal-900 py-20 text-cream-100 sm:py-28 lg:py-32">
      {/* Ember bloom low-left, so the band is lit from the same side as the
          hero rather than reading as a flat dark slab. */}
      <div className="absolute inset-0 bg-[radial-gradient(65%_55%_at_12%_100%,rgba(169,80,38,0.26),transparent_70%)]" />
      <div className="grain absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <SectionEyebrow tone="light">{t("home.reviewsEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-100 sm:text-4xl lg:text-[2.75rem]"
            >
              <MaskedWords text={t("home.reviewsTitle")} />
            </h2>
          </div>

          <Link
            data-reveal
            href="/reviews"
            className="link-underline inline-flex items-center gap-2 font-display text-sm font-semibold text-ember-400"
          >
            {t("home.reviewsCta")}
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <ul
          data-reveal-group
          className={`mt-14 grid gap-4 sm:gap-5 ${
            single ? "" : "sm:grid-cols-2 lg:grid-cols-3"
          }`}
        >
          {reviews.map((review, i) => (
            <li
              key={`${review.name}-${i}`}
              data-reveal
              className={`group relative flex flex-col rounded-2xl border border-cream-200/12 bg-charcoal-900/80 p-7 transition-colors duration-500 hover:border-ember-500/30 hover:bg-charcoal-800 sm:p-8 ${
                single ? "mx-auto max-w-3xl" : ""
              }`}
            >
              <Quote
                size={single ? 40 : 30}
                aria-hidden="true"
                className="text-ember-500/35 transition-colors duration-500 group-hover:text-ember-500/60"
              />

              <blockquote
                className={`mt-5 flex-1 text-pretty leading-relaxed text-cream-100/90 ${
                  single ? "font-display text-xl sm:text-2xl" : "text-[0.975rem]"
                }`}
              >
                {review.text}
              </blockquote>

              <footer className="mt-6 border-t border-cream-200/10 pt-5">
                <div
                  className="flex items-center gap-0.5 text-ember-400"
                  aria-label={t("home.reviewsRating", { rating: review.rating })}
                >
                  {Array.from({ length: 5 }, (_, star) => (
                    <Star
                      key={star}
                      size={14}
                      aria-hidden="true"
                      className={
                        star < review.rating
                          ? "fill-current"
                          : "text-cream-200/20"
                      }
                    />
                  ))}
                </div>
                <p className="mt-2 font-display text-sm font-semibold text-cream-100">
                  {review.name}
                </p>
                {review.source && (
                  <p className="mt-0.5 text-xs text-cream-200/55">
                    {t("home.reviewsVia", { source: review.source })}
                  </p>
                )}
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
