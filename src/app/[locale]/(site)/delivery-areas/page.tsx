import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { MapPin, MessageCircle, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { localeAlternates } from "@/lib/seo";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { getPublicSettings } from "@/lib/admin/store";
import { formatEuro } from "@/lib/money";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import DeliveryMap from "@/components/home/DeliveryMap";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "deliveryAreas" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates(locale, "/delivery-areas"),
  };
}

export default async function DeliveryAreasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "deliveryAreas" });
  const tWhatsapp = await getTranslations({ locale, namespace: "whatsapp" });
  const settings = await getPublicSettings();

  const whatsappHref = whatsappOrderLink(tWhatsapp("orderGeneric"));

  const facts = [
    { label: t("factRadius"), value: `${siteConfig.deliveryRadiusKm} km` },
    { label: t("factFee"), value: formatEuro(settings.deliveryFee) },
    { label: t("factMinimum"), value: formatEuro(settings.minimumOrder) },
    {
      label: t("factFreeOver"),
      value:
        settings.freeDeliveryOver != null
          ? formatEuro(settings.freeDeliveryOver)
          : t("noFreeDelivery"),
    },
  ];

  return (
    <div className="bg-cream-200">
      <Motion />
      <BreadcrumbSchema
        locale={locale}
        items={[{ name: t("title"), path: "/delivery-areas" }]}
      />

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

        <dl
          data-reveal-group
          className="mx-auto mt-10 grid max-w-4xl grid-cols-2 gap-4 lg:grid-cols-4"
        >
          {facts.map((fact) => (
            <div
              key={fact.label}
              data-reveal
              className="rounded-2xl border border-charcoal-600/10 bg-cream-50 p-5 text-center sm:p-7"
            >
              <dt className="text-xs font-semibold uppercase tracking-[0.12em] text-ember-600">
                {fact.label}
              </dt>
              <dd className="mt-2 font-display text-xl font-semibold text-charcoal-600 sm:text-2xl">
                {fact.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      {/* ---- map ------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <SectionEyebrow className="justify-center">{t("mapEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
          >
            <MaskedWords text={t("mapTitle")} />
          </h2>
        </div>

        <div data-reveal="scale" className="mx-auto mt-10 w-full max-w-2xl">
          <DeliveryMap />
        </div>
      </div>

      {/* ---- towns list ------------------------------------------------- */}
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <SectionEyebrow>{t("townsEyebrow")}</SectionEyebrow>
        <h2
          data-reveal-mask
          className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
        >
          <MaskedWords text={t("townsTitle")} />
        </h2>
        <p data-reveal className="mt-4 max-w-xl text-pretty text-base leading-relaxed text-ink/70">
          {t("townsIntro")}
        </p>

        <ul
          data-reveal-group
          className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {siteConfig.deliveryAreaTowns.map((town) => (
            <li
              key={town.name}
              data-reveal
              className="flex items-center justify-between gap-3 rounded-2xl border border-charcoal-600/10 bg-cream-50 px-5 py-4"
            >
              <span className="flex items-center gap-2.5 font-display text-sm font-semibold text-charcoal-600">
                <MapPin size={15} aria-hidden="true" className="shrink-0 text-ember-600/70" />
                {town.name}
              </span>
              <span className="text-sm text-ink/55">
                {town.km.toFixed(1).replace(".", locale === "nl" ? "," : ".")} km
              </span>
            </li>
          ))}
        </ul>

        <p data-reveal className="mt-8 max-w-xl text-sm leading-relaxed text-ink/55">
          {t("outsideNote")}
        </p>
      </div>

      {/* ---- cta ------------------------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div
          data-reveal="scale"
          className="rounded-[2rem] bg-charcoal-900 px-8 py-14 text-center sm:px-16 sm:py-20"
        >
          <h2 className="text-balance font-display text-3xl font-semibold leading-tight text-cream-50 sm:text-4xl">
            {t("ctaTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-cream-200/75 sm:text-lg">
            {t("ctaText")}
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ember-600 px-8 py-4 text-sm font-semibold text-cream-50 shadow-lg shadow-ember-800/30 transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
            >
              <MessageCircle size={18} />
              {t("ctaWhatsapp")}
            </a>
            <Link
              href="/menu"
              className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-cream-100/30 bg-cream-100/10 px-8 py-4 text-sm font-semibold text-cream-100 backdrop-blur-sm transition-transform duration-300 hover:-translate-y-0.5 sm:w-auto"
            >
              <UtensilsCrossed size={18} className="transition-transform duration-300 group-hover:rotate-12" />
              {t("ctaMenu")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
