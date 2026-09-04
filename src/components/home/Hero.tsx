import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowDown, MessageCircle, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";

export default async function Hero({
  locale,
  hasVideo,
}: {
  locale: string;
  hasVideo: boolean;
}) {
  const t = await getTranslations({ locale });
  const whatsappHref = whatsappOrderLink(t("whatsapp.orderGeneric"));

  return (
    <section
      data-hero-root
      className="relative flex min-h-[100svh] items-center overflow-hidden bg-charcoal-950"
    >
      {/* ---- background media ------------------------------------------ */}
      {/* Inset past the edges so the parallax drift never exposes a seam. */}
      <div data-hero-media className="absolute -inset-y-[10%] inset-x-0">
        {hasVideo ? (
          <video
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster="/images/hero-poster.jpg"
            className="h-full w-full object-cover"
          >
            <source src="/video/hero.mp4" type="video/mp4" />
          </video>
        ) : (
          <Image
            src="/images/hero-poster.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover"
          />
        )}
      </div>

      {/* ---- scrims ------------------------------------------------------ */}
      {/* Two stacked gradients: a vertical one to seat the type, and a warm
          ember glow low-left that ties the image back to the logo's flame. */}
      <div className="absolute inset-0 bg-gradient-to-b from-charcoal-950/90 via-charcoal-950/65 to-charcoal-950/95" />
      <div className="absolute inset-0 bg-[radial-gradient(80%_60%_at_15%_100%,rgba(169,80,38,0.42),transparent_65%)]" />
      <div className="grain absolute inset-0" />

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
          <Image
            src="/logo/kebabish-dark.png"
            alt={`${siteConfig.brandName} — ${siteConfig.companyName}`}
            width={440}
            height={330}
            priority
            className="h-auto w-20 sm:w-28"
          />
        </div>

        <p
          data-hero-eyebrow
          data-reveal
          className="mt-5 inline-flex items-center gap-2 rounded-full border border-cream-200/25 bg-cream-200/10 px-4 py-1.5 text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-cream-200/90 backdrop-blur-sm sm:mt-7 sm:text-[0.7rem]"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
          {t("hero.eyebrow")}
        </p>

        <h1
          data-reveal-mask
          className="mt-5 text-balance font-display text-[2.05rem] font-semibold leading-[1.06] text-cream-100 sm:mt-6 sm:text-6xl lg:text-7xl"
        >
          <MaskedWords text={t("hero.title")} />
        </h1>

        <p
          data-hero-sub
          data-reveal
          className="mt-4 font-display text-base italic text-ember-400 sm:mt-5 sm:text-xl"
        >
          {t("hero.subtitle")}
        </p>

        <p
          data-hero-desc
          data-reveal
          className="mx-auto mt-3 max-w-xl text-pretty text-[0.95rem] leading-relaxed text-cream-200/80 sm:mt-4 sm:text-lg"
        >
          {t("hero.description")}
        </p>

        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:mt-9 sm:flex-row">
          <Link
            data-hero-cta
            data-reveal
            href="/menu"
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ember-600 px-8 py-4 text-sm font-semibold text-cream-50 shadow-lg shadow-ember-800/30 transition-[background-color,transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 hover:shadow-xl hover:shadow-ember-800/40 sm:w-auto"
          >
            <UtensilsCrossed
              size={18}
              className="transition-transform duration-300 group-hover:rotate-12"
            />
            {t("hero.ctaOrder")}
          </Link>

          <a
            data-hero-cta
            data-reveal
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-cream-200/30 bg-cream-200/10 px-8 py-4 text-sm font-semibold text-cream-100 backdrop-blur-sm transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-cream-200/20 sm:w-auto"
          >
            <MessageCircle size={18} />
            {t("hero.ctaWhatsapp")}
          </a>
        </div>

        <p
          data-hero-badge
          data-reveal
          className="mt-6 px-8 text-[0.65rem] font-medium uppercase tracking-[0.16em] text-cream-200/55 sm:mt-7 sm:px-0 sm:text-[0.7rem]"
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
        <span className="flex flex-col items-center gap-2 text-[0.65rem] font-medium uppercase tracking-[0.22em] text-cream-200/50">
          {t("hero.scrollCue")}
          <ArrowDown size={14} className="animate-bounce" />
        </span>
      </div>
    </section>
  );
}
