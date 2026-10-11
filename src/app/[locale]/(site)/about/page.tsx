import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Flame, Leaf, Clock, Smartphone, MessageCircle, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { menu } from "@/lib/menu-data";
import { pageMetadata } from "@/lib/seo";
import PageSchema from "@/components/schema/PageSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import StoryFrame from "@/components/shared/StoryFrame";
import VideoBanner from "@/components/shared/VideoBanner";
import { getHeroVideoAvailability } from "@/lib/hero-video";
import { HERO_POSTER_MOBILE, HERO_POSTER_WEB } from "@/lib/hero-posters";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

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
  const tWhatsapp = await getTranslations({ locale, namespace: "whatsapp" });
  const tHome = await getTranslations({ locale, namespace: "home" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });

  const whatsappHref = whatsappOrderLink(tWhatsapp("orderGeneric"));

  // The banner is wide, so the widescreen clip suits it; the vertical one is
  // the fallback when that file is missing. Checked at build time, and the
  // banner falls back to its still if neither exists.
  const { web, mobile } = getHeroVideoAvailability();
  const bannerVideo = web
    ? "/video/hero-web.mp4"
    : mobile
      ? "/video/hero-mobile.mp4"
      : null;

  const stats = [
    { value: `${siteConfig.deliveryRadiusKm} km`, label: t("statsLabel1") },
    { value: "100%", label: t("statsLabel2") },
    { value: String(menu.length), label: t("statsLabel3") },
  ];

  const values = [
    { icon: Flame, title: tHome("why1Title"), text: tHome("why1Text") },
    { icon: Leaf, title: tHome("why2Title"), text: tHome("why2Text") },
    { icon: Clock, title: tHome("why3Title"), text: tHome("why3Text") },
    { icon: Smartphone, title: tHome("why4Title"), text: tHome("why4Text") },
  ];

  const facts = [
    { label: t("factCuisine"), value: t("factCuisineValue") },
    {
      label: t("factLocation"),
      value: `${siteConfig.address.city}, ${siteConfig.address.countryName}`,
    },
    { label: t("factService"), value: t("factServiceValue") },
    { label: t("factRadius"), value: t("factRadiusValue") },
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
            <source media="(min-width: 640px)" srcSet={HERO_POSTER_WEB} />
            <img
              src={HERO_POSTER_MOBILE}
              alt=""
              fetchPriority="high"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </picture>
          {bannerVideo && (
            <VideoBanner
              src={bannerVideo}
              poster={HERO_POSTER_WEB}
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

            <ul data-reveal-group className="mt-10 grid grid-cols-3 gap-4">
              {stats.map((stat) => (
                <li
                  key={stat.label}
                  data-reveal
                  className="border-l-2 border-ember-600/35 pl-4"
                >
                  <span className="block font-display text-2xl font-semibold text-charcoal-600 sm:text-3xl">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-xs leading-snug text-ink/60 sm:text-sm">
                    {stat.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ---- values ------------------------------------------------------ */}
      <div className="relative overflow-hidden bg-charcoal-900 py-20 text-cream-100 sm:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_85%_0%,rgba(169,80,38,0.28),transparent_70%)]" />
        <div className="grain absolute inset-0" />

        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <SectionEyebrow tone="light">{t("valuesEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-100 sm:text-4xl lg:text-[2.75rem]"
            >
              <MaskedWords text={t("valuesTitle")} />
            </h2>
          </div>

          <ul
            data-reveal-group
            className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
          >
            {values.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                data-reveal
                className="group relative rounded-2xl border border-cream-200/12 bg-charcoal-900 p-7 transition-colors duration-500 hover:bg-charcoal-800 sm:p-8"
              >
                <span className="font-display text-xs font-semibold tracking-[0.2em] text-ember-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="mt-5 flex h-12 w-12 items-center justify-center rounded-full border border-ember-500/30 bg-ember-600/12 text-ember-400 transition-[background-color,color] duration-500 group-hover:bg-ember-600 group-hover:text-cream-50">
                  <Icon size={20} />
                </span>
                <h3 className="mt-5 font-display text-lg font-semibold text-cream-100">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-cream-200/65">{text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>

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
          {facts.map((fact) => (
            <div
              key={fact.label}
              data-reveal
              className="rounded-2xl border border-charcoal-600/10 bg-cream-50 p-6 sm:p-7"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-ember-600">
                {fact.label}
              </dt>
              <dd className="mt-2 text-[0.95rem] font-medium leading-snug text-charcoal-600">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- cta ------------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div
          data-reveal="scale"
          className="rounded-[2rem] bg-ember-600 px-8 py-14 text-center sm:px-16 sm:py-20"
        >
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-cream-100/85 sm:text-lg">
            {t("ctaText")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/menu"
              className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-cream-50 px-8 py-4 text-sm font-semibold text-ember-700 shadow-lg shadow-charcoal-950/10 transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
            >
              <UtensilsCrossed
                size={18}
                className="transition-transform duration-300 group-hover:rotate-12"
              />
              {t("ctaMenu")}
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-cream-100/40 bg-cream-50/10 px-8 py-4 text-sm font-semibold text-cream-50 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
            >
              <MessageCircle size={18} />
              {t("ctaWhatsapp")}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
