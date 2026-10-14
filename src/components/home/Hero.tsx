import { getTranslations } from "next-intl/server";
import { ArrowDown, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";
import BrandLogo from "@/components/shared/BrandLogo";
import HeroVideo from "@/components/home/HeroVideo";
import type { VideoMedia } from "@/lib/content/site";

export default async function Hero({
  locale,
  media,
  showBadge = true,
}: {
  locale: string;
  /** The clips and stills — the owner's uploads, or the bundled ones (lib/content/site.ts). */
  media: { web: VideoMedia; mobile: VideoMedia };
  showBadge?: boolean;
}) {
  const hasVideo = Boolean(media.web.video || media.mobile.video);
  const t = await getTranslations({ locale });

  return (
    <section
      data-hero-root
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-charcoal-950"
    >
      {/* ---- background media ------------------------------------------ */}
      {/* Inset past the edges so the parallax drift never exposes a seam. */}
      <div data-hero-media className="absolute -inset-y-[10%] inset-x-0">
        {/* Always the base layer — what a no-JS/slow-JS visitor sees, and
            what shows through until HeroVideo below picks a variant. Two
            stills, not one: they are frames of the two different clips, and
            the vertical one keeps a phone from getting a 16:9 frame blown up
            and cropped. Only the matching one is fetched — `hidden` on a
            <source> inside <picture> would still download, so the choice is
            made by the media attribute, which the browser resolves before it
            requests anything. Plain <img>, since next/image has no art
            direction; these are already small, hand-sized files. */}
        <picture>
          <source media="(min-width: 640px)" srcSet={media.web.poster} />
          <img
            src={media.mobile.poster}
            alt=""
            fetchPriority="high"
            className="absolute inset-0 h-full w-full object-cover"
          />
        </picture>
        {hasVideo && <HeroVideo web={media.web} mobile={media.mobile} />}
      </div>

      {/* ---- scrims ------------------------------------------------------ */}
      {/* The footage is already dark and graded, so it is deliberately NOT
          covered: what used to be a full-bleed 65-95% charcoal wash is now
          only an edge treatment. The top band keeps the fixed header's links
          readable while the page sits at the hero, the bottom one seats the
          scroll cue, and the middle — the actual food — is left untouched.
          Contrast for the copy comes from the type itself (type-on-media)
          and the soft bloom below, both of which follow the words instead of
          flattening the whole frame. */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-charcoal-950/70 to-transparent" />
      <div className="absolute inset-x-0 bottom-0 h-52 bg-gradient-to-t from-charcoal-950/65 to-transparent" />
      {/* A warm ember bloom behind the copy block only — reads as light
          thrown from the logo's flame rather than as a filter over the video. */}
      <div className="absolute inset-0 bg-[radial-gradient(52%_44%_at_50%_52%,rgba(10,8,6,0.52),transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(70%_50%_at_12%_105%,rgba(169,80,38,0.3),transparent_62%)]" />

      {/* Cream curtain that lifts on load. */}
      <div
        data-hero-veil
        className="pointer-events-none absolute inset-0 z-20 bg-cream-200"
      />

      {/* ---- copy -------------------------------------------------------- */}
      <div
        data-hero-copy
        className="relative z-10 mx-auto w-full max-w-4xl px-5 pb-16 pt-24 text-center sm:px-6 sm:pb-28 sm:pt-28"
      >
        <div data-hero-mark data-reveal className="flex justify-center">
          <BrandLogo
            src="/logo/kebabish-dark.png"
            alt={siteConfig.brandName}
            width={300}
            height={225}
            priority
            className="h-auto w-20 sm:w-28"
          />
        </div>

        {showBadge && (
          <p
            data-hero-eyebrow
            data-reveal
            className="mt-5 inline-flex items-center gap-2 rounded-full border border-cream-100/30 bg-charcoal-950/35 px-4 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cream-100 shadow-lg shadow-charcoal-950/25 backdrop-blur-md sm:mt-7 sm:text-[0.7rem]"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
            {t("hero.eyebrow")}
          </p>
        )}

        <h1
          data-reveal-mask
          className="type-on-media-strong mt-5 text-balance font-display text-[2.05rem] font-semibold leading-[1.06] text-cream-50 sm:mt-6 sm:text-6xl lg:text-7xl"
        >
          <MaskedWords text={t("hero.title")} />
        </h1>

        <p
          data-hero-sub
          data-reveal
          // Cream, not ember: with the scrim gone the tagline sits straight
          // on footage that is frequently bright orange (flames, curry), and
          // ember-on-ember all but disappeared there. Ember still carries the
          // eyebrow dot, the primary button and every section accent.
          className="type-on-media mt-4 font-display text-base italic text-cream-100 sm:mt-5 sm:text-xl"
        >
          {t("hero.subtitle")}
        </p>

        <p
          data-hero-desc
          data-reveal
          className="type-on-media mx-auto mt-3 max-w-xl text-pretty text-[0.95rem] leading-relaxed text-cream-100/95 sm:mt-4 sm:text-lg"
        >
          {t("hero.description")}
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:mt-9 sm:flex-row">
          <Link
            data-hero-cta
            data-reveal
            href="/menu"
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ember-600 px-8 py-4 text-sm font-semibold text-cream-50 shadow-[0_10px_30px_-8px_rgba(10,8,6,0.75)] ring-1 ring-cream-100/15 transition-[background-color,translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 hover:shadow-[0_16px_40px_-10px_rgba(169,80,38,0.8)] sm:w-auto"
          >
            <UtensilsCrossed
              size={18}
              className="transition-transform duration-300 group-hover:rotate-12"
            />
            {t("hero.ctaOrder")}
          </Link>

        </div>

        <p
          data-hero-badge
          data-reveal
          className="type-on-media mt-6 px-8 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-cream-100/80 sm:mt-7 sm:px-0 sm:text-[0.7rem]"
        >
          {t("hero.badge")}
        </p>
      </div>

      {/* ---- scroll cue -------------------------------------------------- */}
      <div
        data-hero-cue
        data-reveal
        className="absolute inset-x-0 bottom-6 z-10 hidden justify-center sm:flex"
      >
        <span className="type-on-media flex flex-col items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-cream-100/70">
          {t("hero.scrollCue")}
          <ArrowDown size={14} className="animate-bounce" />
        </span>
      </div>
    </section>
  );
}
