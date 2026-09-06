import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Flame, Leaf, Clock, Smartphone, MessageCircle, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { menu } from "@/lib/menu-data";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("title"), description: t("intro") };
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

  const whatsappHref = whatsappOrderLink(tWhatsapp("orderGeneric"));

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

      {/* ---- intro ---------------------------------------------------- */}
      <div className="mx-auto max-w-6xl px-5 pt-16 sm:px-6 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <p
            data-reveal
            className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-600"
          >
            {t("title")}
          </p>
          <h1
            data-reveal-mask
            className="mt-3 text-balance font-display text-4xl font-semibold leading-tight text-charcoal-600 sm:text-5xl"
          >
            <MaskedWords text={t("intro")} />
          </h1>
        </div>
      </div>

      {/* ---- story ------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="relative order-2 lg:order-1">
            <div
              data-reveal="scale"
              className="relative aspect-4/5 overflow-hidden rounded-[1.75rem] bg-charcoal-800 sm:aspect-3/4"
            >
              <Image
                src="/images/story/tandoor.jpg"
                alt={tHome("storyImageAlt1")}
                fill
                sizes="(min-width: 1024px) 45vw, 90vw"
                data-parallax="0.06"
                className="scale-110 object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/45 to-transparent" />
            </div>
            <div
              data-reveal="scale"
              data-reveal-delay="0.12"
              className="absolute -bottom-8 -right-4 hidden aspect-square w-40 overflow-hidden rounded-2xl border-[6px] border-cream-200 bg-charcoal-800 shadow-xl shadow-charcoal-950/10 sm:block sm:w-48 lg:-right-8"
            >
              <Image
                src="/images/story/spices.jpg"
                alt={tHome("storyImageAlt2")}
                fill
                sizes="200px"
                className="object-cover"
              />
            </div>
          </div>

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
            className="mt-14 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-cream-200/12 bg-cream-200/12 sm:grid-cols-2 lg:grid-cols-4"
          >
            {values.map(({ icon: Icon, title, text }, i) => (
              <li
                key={title}
                data-reveal
                className="group relative bg-charcoal-900 p-7 transition-colors duration-500 hover:bg-charcoal-800 sm:p-8"
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
          className="mt-10 grid grid-cols-1 gap-px overflow-hidden rounded-3xl border border-charcoal-600/10 bg-charcoal-600/10 sm:grid-cols-2 lg:grid-cols-4"
        >
          {facts.map((fact) => (
            <div key={fact.label} data-reveal className="bg-cream-50 p-6 sm:p-7">
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
