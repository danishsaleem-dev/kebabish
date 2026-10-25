import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Bike, Clock, Gift, MapPin, MessageCircle, Navigation, ShoppingBasket, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { pageMetadata } from "@/lib/seo";
import ServiceSchema from "@/components/schema/ServiceSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { getPublicSettings } from "@/lib/admin/store";
import { formatEuro } from "@/lib/money";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import DeliveryMap from "@/components/home/DeliveryMap";
import FeedbackCta from "@/components/feedback/FeedbackCta";
import DeliveryCheck from "@/components/DeliveryCheck";
import { dayName, summariseHours } from "@/lib/opening-hours";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  // The first few towns by distance (the kitchen's own town excluded), spoken
  // as a list in the page's language — a searcher for a town finds its name.
  const towns = new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(
    siteConfig.deliveryAreaTowns
      .filter((town) => town.name !== siteConfig.address.city)
      .slice(0, 3)
      .map((town) => town.name)
  );
  return pageMetadata({
    locale,
    path: "/delivery-areas",
    title: t("deliveryTitle"),
    description: t("deliveryDescription", { radius: siteConfig.deliveryRadiusKm, towns }),
  });
}

/**
 * Delivery area. The first thing people come here for is "do you deliver to me?", so
 * that is answered at the top — the postcode check beside the headline, using the same
 * distance rule as checkout (`DeliveryCheck` → `checkDeliveryAction`). Then the costs
 * (from Settings, so they match the basket), the delivery times (from the opening hours,
 * the same source as checkout's slots), the map, and the towns by distance — the towns
 * are examples, not the rule: the rule is the distance.
 */
export default async function DeliveryAreasPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "deliveryAreas" });
  const tAll = await getTranslations({ locale });
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const settings = await getPublicSettings();

  const whatsappHref = whatsappOrderLink(tAll("whatsapp.orderGeneric"));
  const radius = siteConfig.deliveryRadiusKm;
  const km = (value: number) =>
    new Intl.NumberFormat(locale === "nl" ? "nl-NL" : "en-GB", { maximumFractionDigits: 1 }).format(value);

  const facts = [
    { icon: Navigation, label: t("factRadius"), value: `${radius} km` },
    {
      icon: Bike,
      label: t("factFee"),
      value: settings.deliveryFee > 0 ? formatEuro(settings.deliveryFee) : tAll("item.deliveryFree"),
    },
    {
      icon: Gift,
      label: t("factFreeOver"),
      value: settings.freeDeliveryOver != null ? formatEuro(settings.freeDeliveryOver) : t("noFreeDelivery"),
    },
    {
      icon: ShoppingBasket,
      label: t("factMinimum"),
      value: settings.minimumOrder > 0 ? formatEuro(settings.minimumOrder) : t("noMinimum"),
    },
  ];

  // Delivery times, from the opening hours (the same source as checkout's slots).
  const summary = summariseHours(settings.hours);
  const groupLabel = (days: number[]) =>
    days.length === 1
      ? dayName(days[0], locale, "long")
      : `${dayName(days[0], locale, "long")} – ${dayName(days[days.length - 1], locale, "long", locale !== "nl")}`;

  const towns = [...siteConfig.deliveryAreaTowns].sort((a, b) => a.km - b.km);

  return (
    <div className="relative isolate bg-cream-200">
      <Motion />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[32rem] bg-[radial-gradient(55%_70%_at_15%_0%,rgba(169,80,38,0.14),transparent_70%)]"
      />
      <ServiceSchema
        locale={locale}
        path="/delivery-areas"
        name={tSeo("deliveryServiceName")}
        serviceType={tSeo("deliveryServiceType")}
        description={tSeo("deliveryTitle")}
      />
      <BreadcrumbSchema locale={locale} items={[{ name: t("title"), path: "/delivery-areas" }]} />

      {/* ---- hero: the question, answered ------------------------------- */}
      <div className="mx-auto grid max-w-6xl items-start gap-10 px-5 pb-10 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1fr_1fr] lg:gap-14">
        <div className="min-w-0">
          <SectionEyebrow>{t("title")}</SectionEyebrow>
          <h1
            data-reveal-mask
            className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.08] text-charcoal-600 sm:text-5xl"
          >
            <MaskedWords text={t("intro")} />
          </h1>

          <div data-reveal className="mt-8 rounded-3xl bg-charcoal-800 p-6 text-cream-100 shadow-xl shadow-charcoal-950/15 sm:p-7">
            <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold text-cream-50">
              <MapPin size={19} aria-hidden="true" className="text-ember-400" />
              {t("ctaTitle")}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-cream-200/70">{tAll("contact.deliveryCheckText")}</p>
            <DeliveryCheck whatsappHref={whatsappOrderLink(tAll("contact.deliveryCheckWhatsapp"))} />
          </div>

          <dl data-reveal-group className="mt-6 grid grid-cols-2 gap-3">
            {facts.map(({ icon: Icon, label, value }) => (
              <div key={label} data-reveal className="flex items-center gap-3 rounded-2xl bg-cream-50 p-4 ring-1 ring-charcoal-600/8">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ember-600/10 text-ember-600">
                  <Icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <dt className="truncate text-[0.7rem] font-semibold uppercase tracking-[0.1em] text-ink/50">{label}</dt>
                  <dd className="font-display text-lg font-semibold leading-tight text-charcoal-600">{value}</dd>
                </div>
              </div>
            ))}
          </dl>
        </div>

        <div data-reveal="scale" className="min-w-0 lg:sticky lg:top-24">
          <DeliveryMap />
        </div>
      </div>

      {/* ---- when we deliver -------------------------------------------- */}
      {summary.groups.length > 0 && (
        <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6">
          <div data-reveal className="grid gap-6 rounded-[2rem] bg-cream-50 p-6 ring-1 ring-charcoal-600/8 sm:p-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div>
              <h2 className="flex items-center gap-2.5 font-display text-2xl font-semibold text-charcoal-600">
                <Clock size={22} aria-hidden="true" className="text-ember-600" />
                {t("timesTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ink/65">{t("timesText")}</p>
            </div>
            <ul className="space-y-2">
              {summary.groups.map((g) => (
                <li
                  key={g.days.join("-")}
                  className="flex items-center justify-between gap-3 rounded-2xl bg-cream-100 px-4 py-3"
                >
                  <span className="text-sm font-semibold text-charcoal-600">{groupLabel(g.days)}</span>
                  <span className="font-display text-base font-semibold tabular-nums text-ember-700">
                    {g.opens} – {g.closes}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ---- towns, by distance ------------------------------------------ */}
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-6 sm:py-16">
        <SectionEyebrow>{t("townsEyebrow")}</SectionEyebrow>
        <h2
          data-reveal-mask
          className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
        >
          <MaskedWords text={t("townsTitle")} />
        </h2>
        <p data-reveal className="mt-4 max-w-2xl text-pretty text-base leading-relaxed text-ink/70">
          {t("townsIntro")}
        </p>

        <ul data-reveal-group className="mt-8 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {towns.map((town) => (
            <li key={town.name} data-reveal className="rounded-2xl bg-cream-50 px-4 py-3.5 ring-1 ring-charcoal-600/8">
              <div className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-2 font-display text-sm font-semibold text-charcoal-600">
                  <MapPin size={15} aria-hidden="true" className="shrink-0 text-ember-600/70" />
                  {town.name}
                </span>
                <span className="text-sm tabular-nums text-ink/55">{km(town.km)} km</span>
              </div>
              {/* How far, against the radius. */}
              <span aria-hidden="true" className="mt-2.5 block h-1 overflow-hidden rounded-full bg-charcoal-600/8">
                <span
                  className="block h-full rounded-full bg-linear-to-r from-ember-400 to-ember-600"
                  style={{ width: `${Math.min(100, Math.max(6, (town.km / radius) * 100))}%` }}
                />
              </span>
            </li>
          ))}
        </ul>

        <p data-reveal className="mt-6 max-w-2xl text-sm leading-relaxed text-ink/55">
          {t("outsideNote")}
        </p>
      </div>

      {/* ---- slim closing row ---------------------------------------------- */}
      <div className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div
          data-reveal="scale"
          className="relative overflow-hidden rounded-[2rem] bg-charcoal-900 px-6 py-9 text-cream-100 sm:px-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(60%_80%_at_100%_0%,rgba(169,80,38,0.3),transparent_70%)]" />
          <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <h2 className="font-display text-2xl font-semibold text-cream-50 sm:text-3xl">{t("closingTitle")}</h2>
              <p className="mt-2 text-sm text-cream-200/75 sm:text-base">{t("ctaText")}</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
              <Link
                href="/menu"
                className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-ember-600 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-ember-900/30 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
              >
                <UtensilsCrossed size={17} className="transition-transform duration-300 group-hover:rotate-12" />
                {t("ctaMenu")}
              </Link>
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-cream-100/25 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-cream-100/10"
              >
                <MessageCircle size={17} />
                {t("ctaWhatsapp")}
              </a>
            </div>
          </div>
        </div>
      </div>

      <FeedbackCta locale={locale} />
    </div>
  );
}
