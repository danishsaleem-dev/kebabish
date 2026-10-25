import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Bike, ChefHat, MapPin, Navigation, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site-config";
import { getPublicCategories } from "@/lib/public-menu";
import { pageMetadata } from "@/lib/seo";
import PageSchema from "@/components/schema/PageSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import StoryFrame from "@/components/shared/StoryFrame";
import VideoBanner from "@/components/shared/VideoBanner";
import { getSiteMedia } from "@/lib/content/site";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import FeedbackCta from "@/components/feedback/FeedbackCta";
import Why from "@/components/home/Why";
import HowItWorks from "@/components/home/HowItWorks";
import Founder from "@/components/home/Founder";
import Testimonials from "@/components/home/Testimonials";
import { getPublicSettings } from "@/lib/admin/store";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/about",
    title: t("aboutTitle"),
    description: t("aboutDescription"),
  });
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });
  const tHome = await getTranslations({ locale, namespace: "home" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });


  // The banner is wide, so it plays its own clip if the owner set one, else
  // the homepage's widescreen clip (see getSiteMedia). It shows its still if
  // there is no clip at all. On a phone the still is the tall homepage one,
  // unless the banner has a clip of its own, whose frame is used at every width.
  const [media, settings] = await Promise.all([getSiteMedia(), getPublicSettings()]);
  const banner = media.aboutBanner;
  const bannerVideo = banner.video;
  const bannerMobilePoster = banner === media.heroWeb ? media.heroMobile.poster : banner.poster;

  const stats = [
    { value: `${siteConfig.deliveryRadiusKm} km`, label: t("statsLabel1") },
    { value: "100%", label: t("statsLabel2") },
    { value: String((await getPublicCategories(locale)).length), label: t("statsLabel3") },
  ];


  const facts = [
    { icon: ChefHat, label: t("factCuisine"), value: t("factCuisineValue") },
    {
      icon: MapPin,
      label: t("factLocation"),
      value: `${siteConfig.address.city}, ${siteConfig.address.countryName}`,
    },
    { icon: Bike, label: t("factService"), value: t("factServiceValue") },
    { icon: Navigation, label: t("factRadius"), value: t("factRadiusValue") },
  ];

  return (
    <div className="bg-cream-200">
      <Motion />
      <PageSchema
        locale={locale}
        path="/about"
        type="AboutPage"
        name={tSeo("aboutTitle")}
        description={tSeo("aboutDescription")}
      />
      <BreadcrumbSchema locale={locale} items={[{ name: t("title"), path: "/about" }]} />

      {/* ---- banner ---------------------------------------------------- */}
      {/* Carries the page's only <h1>. Same treatment as the homepage hero:
          the footage is not dimmed by a full-bleed wash — only the top band
          (for the fixed header), a bottom fade into the cream page, and a
          bloom behind the words — and the type earns its contrast with
          `type-on-media`. */}
      <section className="relative isolate flex min-h-[58svh] items-end overflow-hidden bg-charcoal-950 sm:min-h-[62svh]">
        <div className="absolute inset-0">
          <picture>
            <source media="(min-width: 640px)" srcSet={banner.poster} />
            <img
              src={bannerMobilePoster}
              alt=""
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          {bannerVideo && (
            <VideoBanner
              src={bannerVideo}
              poster={banner.poster}
              label={t("bannerVideoLabel")}
            />
          )}
        </div>

        <div className="absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-charcoal-950/70 to-transparent" />
        <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_85%,rgba(10,8,6,0.6),transparent_72%)]" />
        <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-cream-200 to-transparent" />
        <div className="grain absolute inset-0" />

        <div className="relative z-10 mx-auto w-full max-w-6xl px-5 pb-16 pt-28 sm:px-6 sm:pb-20 sm:pt-32">
          <div className="max-w-3xl">
            <p
              data-reveal
              className="type-on-media inline-flex items-center gap-3 font-display text-xs font-semibold uppercase tracking-[0.2em] text-cream-100"
            >
              <span aria-hidden="true" className="h-px w-8 bg-ember-500" />
              {t("title")}
            </p>
            <h1
              data-reveal-mask
              className="type-on-media-strong mt-5 text-balance font-display text-4xl font-semibold leading-[1.08] text-cream-50 sm:text-5xl lg:text-6xl"
            >
              <MaskedWords text={t("intro")} />
            </h1>
            <p
              data-reveal
              className="type-on-media mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream-100/95 sm:text-lg"
            >
              {t("bannerText")}
            </p>
          </div>
        </div>
      </section>

      {/* ---- story ------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <StoryFrame
            videoLabel={tHome("storyVideoLabel")}
            posterAlt={tHome("storyImageAlt1")}
            detailAlt={tHome("storyImageAlt2")}
          />

          <div className="order-1 lg:order-2">
            <SectionEyebrow>{t("storyEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl lg:text-[2.75rem]"
            >
              <MaskedWords text={t("storyTitle")} />
            </h2>
            <p
              data-reveal
              className="mt-6 text-pretty text-base leading-relaxed text-ink/75 sm:text-lg"
            >
              {t("storyText1")}
            </p>
            <p
              data-reveal
              className="mt-4 text-pretty text-base leading-relaxed text-ink/75 sm:text-lg"
            >
              {t("storyText2")}
            </p>

            <ul data-reveal-group className="mt-10 grid grid-cols-3 gap-3 sm:gap-4">
              {stats.map((stat) => (
                <li
                  key={stat.label}
                  data-reveal
                  className="min-w-0 border-l-2 border-ember-600/35 pl-3 sm:pl-4"
                >
                  <span className="block font-display text-2xl font-semibold text-charcoal-600 sm:text-3xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 block hyphens-auto [overflow-wrap:anywhere] text-xs leading-snug text-ink/60 sm:text-sm">
                    {stat.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ---- values: the homepage's tile grid, under this page's own heading ---- */}
      <Why locale={locale} eyebrow={t("valuesEyebrow")} title={t("valuesTitle")} />

      {/* ---- how ordering works ---------------------------------------- */}
      <HowItWorks locale={locale} settings={settings} />

      {/* ---- the family's note ------------------------------------------ */}
      <Founder locale={locale} />

      {/* ---- what customers say (renders nothing until there are reviews) */}
      <Testimonials locale={locale} />

      {/* ---- facts strip --------------------------------------------------- */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <SectionEyebrow>{t("factsEyebrow")}</SectionEyebrow>
        <h2
          data-reveal-mask
          className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
        >
          <MaskedWords text={t("factsTitle")} />
        </h2>

        <dl
          data-reveal-group
          className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          {facts.map(({ icon: Icon, ...fact }) => (
            <div
              key={fact.label}
              data-reveal
              className="flex items-start gap-4 rounded-3xl bg-cream-50 p-5 ring-1 ring-charcoal-600/8 sm:p-6"
            >
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600">
                <Icon size={20} aria-hidden="true" />
              </span>
              <div>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ember-600">
                {fact.label}
              </dt>
              <dd className="mt-2 text-[0.95rem] font-medium leading-snug text-charcoal-600">
                {fact.value}
              </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- cta: one slim row, like the homepage's closing band ---------- */}
      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div
          data-reveal="scale"
          className="relative overflow-hidden rounded-[2rem] bg-[linear-gradient(120deg,#8c401d_0%,#a95026_50%,#c9713e_100%)] px-6 py-9 sm:px-10"
        >
          <div className="grain absolute inset-0" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="text-balance font-display text-2xl font-semibold leading-tight text-cream-50 sm:text-3xl">
                {t("ctaTitle")}
              </h2>
              <p className="mt-2 text-pretty text-sm text-cream-100/85 sm:text-base">{t("ctaText")}</p>
            </div>
            <Link
              href="/menu"
              className="group inline-flex shrink-0 items-center justify-center gap-2.5 rounded-full bg-cream-50 px-7 py-3.5 font-display text-sm font-semibold text-ember-700 shadow-lg shadow-charcoal-950/15 transition-transform duration-300 hover:-translate-y-0.5"
            >
              <UtensilsCrossed size={17} className="transition-transform duration-300 group-hover:rotate-12" />
              {t("ctaMenu")}
            </Link>
          </div>
        </div>
      </div>

      <FeedbackCta locale={locale} />
    </div>
  );
}
