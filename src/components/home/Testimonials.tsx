import { getTranslations } from "next-intl/server";
import { ArrowUpRight, Star } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getReviews } from "@/lib/content/site";
import type { Review } from "@/lib/reviews-data";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

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
 * The quotes run as **two rows sliding in opposite directions** (Danish's design),
 * fading out at both edges, and a row stops while the pointer is over it (or anything
 * in it has keyboard focus) so it can be read. Pure CSS — `.review-track` in
 * globals.css — so nothing here is a client component:
 *
 * - Each row is one "set" of cards rendered twice, and the track slides by exactly
 *   half its width (`translateX(-50%)`), so the loop is seamless. A set repeats the
 *   reviews until it holds at least `MIN_PER_SET` cards, so even three reviews fill a
 *   wide screen. The second row starts at a different review, so the two rows never
 *   line up.
 * - The copies are `aria-hidden` and `inert`: a screen reader and the keyboard meet
 *   each review once (in the first set of the first row's order).
 * - Speed follows the number of cards, so it reads the same however many reviews
 *   there are. Under `prefers-reduced-motion` nothing moves; the rows simply scroll.
 */

const MIN_PER_SET = 8;
const SECONDS_PER_CARD = 7;

function fill(list: Review[]): Review[] {
  const out: Review[] = [];
  while (out.length < MIN_PER_SET) out.push(...list);
  return out;
}

export default async function Testimonials({
  locale,
  compact = false,
}: {
  locale: string;
  /** Less padding and a smaller heading, for pages where the quotes are not the main event (a dish, the feedback form). */
  compact?: boolean;
}) {
  const reviews = await getReviews();
  if (reviews.length === 0) return null;

  const t = await getTranslations({ locale });
  // The compact version goes on pages without the Motion island (a dish, the feedback
  // form), where scroll-reveal attributes would leave it invisible — so it has none.
  const reveal = !compact;
  const r = (value = "") => (reveal ? value : undefined);
  const average = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
  const averageLabel = new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(average);

  // Row two starts halfway through the list, so the rows are visibly different.
  const shift = Math.ceil(reviews.length / 2);
  const rows = [fill(reviews), fill([...reviews.slice(shift), ...reviews.slice(0, shift)])];

  return (
    <section
      className={`relative overflow-hidden bg-charcoal-900 text-cream-100 ${
        compact ? "py-14 sm:py-16" : "py-20 sm:py-28 lg:py-32"
      }`}
    >
      {/* Ember bloom low-left and a softer one top-right, so the band is lit
          rather than reading as a flat dark slab. */}
      <div className="absolute inset-0 bg-[radial-gradient(65%_55%_at_12%_100%,rgba(169,80,38,0.22),transparent_70%),radial-gradient(40%_40%_at_90%_0%,rgba(169,80,38,0.14),transparent_70%)]" />
      <div className="grain absolute inset-0" />

      <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-2xl">
            <SectionEyebrow tone="light" reveal={reveal}>{t("home.reviewsEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask={r()}
              className={`mt-5 text-balance font-display font-semibold leading-[1.15] text-cream-100 ${
                compact ? "text-2xl sm:text-3xl" : "text-3xl sm:text-4xl lg:text-[2.75rem]"
              }`}
            >
              <MaskedWords text={t("home.reviewsTitle")} />
            </h2>
          </div>

          <div data-reveal={r()} className="flex items-center gap-5">
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

      <div data-reveal={r()} className={`relative z-10 space-y-5 sm:space-y-6 ${compact ? "mt-8" : "mt-12 sm:mt-14"}`}>
        {rows.map((row, r) => (
          <div
            key={r}
            className="review-row group overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)] motion-reduce:overflow-x-auto motion-reduce:[scrollbar-width:none]"
          >
            <div
              className={`review-track flex w-max ${r === 1 ? "review-track-reverse" : ""}`}
              style={{ ["--review-duration" as string]: `${row.length * SECONDS_PER_CARD}s` }}
            >
              {[0, 1].map((copy) => (
                <ul
                  key={copy}
                  // The copy (and all of row two) is decoration for the loop; each
                  // review is announced once, from the first set of row one.
                  aria-hidden={copy === 1 || r === 1 ? true : undefined}
                  inert={copy === 1 || r === 1 ? true : undefined}
                  className="flex gap-5 pr-5 sm:gap-6 sm:pr-6"
                >
                  {row.map((review, i) => (
                    <ReviewCard
                      key={i}
                      review={review}
                      // Only the first round of real reviews counts for screen readers.
                      hidden={copy === 1 || r === 1 || i >= reviews.length}
                      ratingLabel={t("home.reviewsRating", { rating: review.rating })}
                    />
                  ))}
                </ul>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="relative z-10 mt-8 flex justify-center sm:hidden">
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

function ReviewCard({
  review,
  hidden,
  ratingLabel,
}: {
  review: Review;
  hidden: boolean;
  ratingLabel: string;
}) {
  return (
    <li
      aria-hidden={hidden || undefined}
      className="flex w-[19rem] shrink-0 flex-col rounded-3xl border border-cream-200/10 bg-charcoal-950/70 p-6 shadow-xl shadow-charcoal-950/30 transition-[border-color,background-color,translate] duration-500 ease-brand hover:-translate-y-1 hover:border-ember-500/40 hover:bg-charcoal-800 sm:w-[25rem] sm:p-8"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="flex gap-0.5 text-ember-400" role="img" aria-label={ratingLabel}>
          {Array.from({ length: 5 }, (_, star) => (
            <Star
              key={star}
              size={15}
              aria-hidden="true"
              className={star < review.rating ? "fill-current" : "text-cream-200/20"}
            />
          ))}
        </span>
        {review.source && (
          <span className="text-[0.65rem] font-semibold uppercase tracking-[0.2em] text-cream-200/45">
            {review.source}
          </span>
        )}
      </div>

      <blockquote className="mt-5 line-clamp-6 flex-1 whitespace-pre-line text-pretty text-[0.95rem] leading-relaxed text-cream-100/85 sm:text-base">
        “{review.text}”
      </blockquote>

      <footer className="mt-6 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-ember-400 to-ember-700 font-display text-sm font-bold text-cream-50"
        >
          {review.name.trim().charAt(0).toUpperCase()}
        </span>
        <span className="truncate font-display text-base font-semibold text-cream-50">{review.name}</span>
      </footer>
    </li>
  );
}
