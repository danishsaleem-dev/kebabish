import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  Phone,
  Mail,
  MapPin,
  Clock,
  Instagram,
  Facebook,
  Music2,
  MessageCircle,
} from "lucide-react";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { localeAlternates } from "@/lib/seo";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import DeliveryMap from "@/components/home/DeliveryMap";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("title"),
    description: t("intro"),
    alternates: localeAlternates(locale, "/contact"),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const tWhatsapp = await getTranslations({ locale, namespace: "whatsapp" });
  const settings = await getPublicSettings();
  const status = getStoreStatus(settings);
  const weekdays = tStatus.raw("weekdays") as string[];
  const sortedHours = [...settings.hours].sort((a, b) => a.day - b.day);
  const fullAddress = `${siteConfig.address.street}, ${siteConfig.address.postalCode} ${siteConfig.address.city}`;
  const whatsappHref = whatsappOrderLink(tWhatsapp("orderGeneric"));

  return (
    <div className="bg-cream-200">
      <BreadcrumbSchema locale={locale} items={[{ name: t("title"), path: "/contact" }]} />
      <div className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="text-center">
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-600">
            {t("title")}
          </p>
          <h1 className="mt-3 text-balance font-display text-4xl font-semibold leading-tight text-charcoal-600 sm:text-5xl">
            {t("intro")}
          </h1>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-[1fr_1fr] lg:gap-10">
          {/* ---- map --------------------------------------------------- */}
          <div className="order-2 lg:order-1">
            <div className="sticky top-28">
              <DeliveryMap />
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 flex items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-6 py-4 font-display text-sm font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5"
              >
                <MessageCircle size={18} />
                {tWhatsapp("orderGeneric").split("!")[0]}!
              </a>
            </div>
          </div>

          {/* ---- details ------------------------------------------------ */}
          <div className="order-1 space-y-5 lg:order-2">
            <div className="rounded-3xl border border-charcoal-600/10 bg-cream-50 p-6 sm:p-8">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
                  <MapPin size={18} />
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold text-charcoal-600">
                    {t("addressTitle")}
                  </h2>
                  <p className="mt-1 text-[0.95rem] text-ink/70">{fullAddress}</p>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-charcoal-600/10 bg-cream-50 p-6 sm:p-8">
              <div className="flex items-start gap-3.5">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
                  <Clock size={18} />
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-base font-semibold text-charcoal-600">
                    {t("hoursTitle")}
                  </h2>
                  <p className="mt-1 text-[0.95rem] text-ink/70">{t("hoursNote")}</p>

                  <div className="mt-3 flex items-center gap-2 text-sm font-semibold">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        status.isOpen ? "bg-green-600" : "bg-charcoal-500"
                      }`}
                      aria-hidden="true"
                    />
                    <span
                      className={status.isOpen ? "text-green-700" : "text-charcoal-500"}
                    >
                      {status.isOpen ? tStatus("openNowLabel") : tStatus("closedNowLabel")}
                    </span>
                  </div>

                  <dl className="mt-4 divide-y divide-charcoal-600/10 border-t border-charcoal-600/10 text-sm">
                    {sortedHours.map((h) => (
                      <div
                        key={h.day}
                        className="flex items-center justify-between gap-2 py-2"
                      >
                        <dt className="text-ink/60">{weekdays[h.day]}</dt>
                        <dd className="font-medium text-charcoal-600">
                          {h.closed ? tStatus("closedLabel") : `${h.opens} – ${h.closes}`}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div className="rounded-3xl border border-charcoal-600/10 bg-cream-50 p-6 sm:p-8">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
                  <Phone size={18} />
                </span>
                <h2 className="mt-3.5 font-display text-base font-semibold text-charcoal-600">
                  {siteConfig.brandName}
                </h2>
                <a
                  href={`tel:${siteConfig.contact.phone}`}
                  className="link-underline mt-2 block text-[0.95rem] text-ink/70"
                >
                  {siteConfig.contact.phone}
                </a>
                <a
                  href={`mailto:${siteConfig.contact.email}`}
                  className="link-underline mt-1.5 flex items-center gap-1.5 text-[0.95rem] text-ink/70"
                >
                  <Mail size={15} /> {siteConfig.contact.email}
                </a>
              </div>

              <div className="rounded-3xl border border-charcoal-600/10 bg-cream-50 p-6 sm:p-8">
                <h2 className="font-display text-base font-semibold text-charcoal-600">
                  {t("socialsTitle")}
                </h2>
                <div className="mt-3.5 flex gap-2.5">
                  <a
                    href={siteConfig.socials.instagram}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-600/10 text-charcoal-600 transition-colors hover:bg-ember-600 hover:text-cream-50"
                    aria-label="Instagram"
                  >
                    <Instagram size={17} />
                  </a>
                  <a
                    href={siteConfig.socials.facebook}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-600/10 text-charcoal-600 transition-colors hover:bg-ember-600 hover:text-cream-50"
                    aria-label="Facebook"
                  >
                    <Facebook size={17} />
                  </a>
                  <a
                    href={siteConfig.socials.tiktok}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-600/10 text-charcoal-600 transition-colors hover:bg-ember-600 hover:text-cream-50"
                    aria-label="TikTok"
                  >
                    <Music2 size={17} />
                  </a>
                </div>
                <p className="mt-3.5 text-sm text-ink/50">{siteConfig.socials.handle}</p>
              </div>
            </div>

            <div className="rounded-3xl bg-charcoal-600 p-6 text-cream-100 sm:p-8">
              <h2 className="font-display text-base font-semibold">
                {t("deliveryCheckTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-cream-200/70">
                {t("deliveryCheckText")}
              </p>
              <p className="mt-4 text-xs italic text-cream-200/45">
                {locale === "nl"
                  ? "Postcode-check komt hier zodra de Google Maps koppeling live is."
                  : "A live postcode check is coming here soon."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
