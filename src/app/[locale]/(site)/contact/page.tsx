import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import {
  ArrowUpRight,
  Bike,
  Clock,
  Facebook,
  Instagram,
  Mail,
  MapPin,
  MessageCircle,
  Music2,
  Phone,
  ShoppingBag,
} from "lucide-react";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { pageMetadata } from "@/lib/seo";
import PageSchema from "@/components/schema/PageSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import { Link } from "@/i18n/navigation";
import DeliveryMap from "@/components/home/DeliveryMap";
import FeedbackCta from "@/components/feedback/FeedbackCta";
import DeliveryCheck from "@/components/DeliveryCheck";
import { amsterdamNow } from "@/lib/delivery-slots";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/contact",
    title: t("contactTitle"),
    description: t("contactDescription"),
  });
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  const tStatus = await getTranslations({ locale, namespace: "status" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const tCommon = await getTranslations({ locale, namespace: "common" });
  const settings = await getPublicSettings();
  const tFooter = await getTranslations({ locale, namespace: "footer" });
  const status = getStoreStatus(settings);
  const weekdays = tStatus.raw("weekdays") as string[];
  // Monday first, the way a Dutch week reads; today (in Amsterdam) is lit.
  const sortedHours = [...settings.hours].sort((a, b) => ((a.day + 6) % 7) - ((b.day + 6) % 7));
  const today = amsterdamNow().weekday;
  // Postcode and town only, as before — the street is not advertised for a delivery-only kitchen.
  const fullAddress = `${siteConfig.address.postalCode} ${siteConfig.address.city}`;

  // The three ways to reach us, one tap each. WhatsApp here is the conversation route
  // (questions, allergies) — ordering goes through the menu (the button by the map).
  const actions = [
    {
      href: whatsappOrderLink(t("whatsappMessage")),
      external: true,
      icon: <MessageCircle size={22} aria-hidden="true" />,
      title: tCommon("whatsappUs"),
      text: t("whatsappText"),
      tone: "bg-[#25D366] text-white",
    },
    {
      href: `tel:${siteConfig.contact.phone.replace(/[^\d+]/g, "")}`,
      external: false,
      icon: <Phone size={22} aria-hidden="true" />,
      title: tCommon("callUs"),
      text: siteConfig.contact.phone,
      tone: "bg-charcoal-700 text-cream-50",
    },
    {
      href: `mailto:${siteConfig.contact.email}`,
      external: false,
      icon: <Mail size={22} aria-hidden="true" />,
      title: t("emailTitle"),
      text: siteConfig.contact.email,
      tone: "bg-ember-600 text-cream-50",
    },
  ];

  return (
    <div className="relative isolate bg-cream-200">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-96 bg-[radial-gradient(55%_70%_at_15%_0%,rgba(169,80,38,0.14),transparent_70%)]"
      />
      <PageSchema
        locale={locale}
        path="/contact"
        type="ContactPage"
        name={tSeo("contactTitle")}
        description={tSeo("contactDescription")}
      />
      <BreadcrumbSchema locale={locale} items={[{ name: t("title"), path: "/contact" }]} />

      <div className="mx-auto max-w-6xl px-5 pb-12 pt-12 sm:px-6 sm:pt-16">
        {/* ---- heading --------------------------------------------------- */}
        <p className="inline-flex items-center gap-3 font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-600">
          <span aria-hidden="true" className="h-px w-8 bg-ember-600/50" />
          {t("title")}
        </p>
        <h1 className="mt-4 max-w-3xl text-balance font-display text-4xl font-semibold leading-[1.1] text-charcoal-600 sm:text-5xl">
          {t("intro")}
        </h1>

        {/* ---- one tap to reach us --------------------------------------- */}
        <ul className="mt-10 grid gap-3 sm:grid-cols-3 sm:gap-4">
          {actions.map((a) => (
            <li key={a.title}>
              <a
                href={a.href}
                {...(a.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                className="group flex h-full items-center gap-4 rounded-3xl bg-cream-50 p-4 ring-1 ring-charcoal-600/8 transition-[translate,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-charcoal-950/10 sm:flex-col sm:items-start sm:p-6"
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-lg shadow-charcoal-950/10 ${a.tone}`}>
                  {a.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5 font-display text-lg font-semibold text-charcoal-600">
                    {a.title}
                    <ArrowUpRight
                      size={16}
                      aria-hidden="true"
                      className="text-ink/35 transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-ember-600"
                    />
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-ink/60">{a.text}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>

        <div className="mt-6 grid gap-6 lg:grid-cols-2 lg:gap-8">
          {/* ---- details -------------------------------------------------- */}
          <div className="min-w-0 space-y-6">
            {/* Hours, with today lit. */}
            <section className="rounded-3xl bg-cream-50 p-6 ring-1 ring-charcoal-600/8 sm:p-7">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold text-charcoal-600">
                  <Clock size={19} aria-hidden="true" className="text-ember-600" />
                  {t("hoursTitle")}
                </h2>
                <span
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${
                    status.openNow ? "bg-success-soft text-success" : "bg-charcoal-600/10 text-charcoal-600/80"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${status.openNow ? "bg-success" : "bg-charcoal-400"}`} />
                  {status.openNow ? tStatus("openNowLabel") : tStatus("closedNowLabel")}
                </span>
              </div>
              <dl className="mt-4 space-y-1 text-sm">
                {sortedHours.map((h) => {
                  const isToday = h.day === today;
                  return (
                    <div
                      key={h.day}
                      className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 ${
                        isToday ? "bg-ember-600/10 font-semibold" : ""
                      }`}
                    >
                      <dt className={isToday ? "text-charcoal-700" : "text-ink/60"}>
                        {weekdays[h.day]}
                        {isToday && (
                          <span className="ml-2 rounded-full bg-ember-600 px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wide text-cream-50">
                            {t("today")}
                          </span>
                        )}
                      </dt>
                      <dd className={`tabular-nums ${h.closed ? "text-ink/45" : "font-medium text-charcoal-600"}`}>
                        {h.closed ? tStatus("closedLabel") : `${h.opens} – ${h.closes}`}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>

            {/* Where we cook — and that we deliver only. */}
            <section className="flex items-start gap-4 rounded-3xl bg-cream-50 p-6 ring-1 ring-charcoal-600/8 sm:p-7">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600">
                <MapPin size={20} aria-hidden="true" />
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-charcoal-600">{t("addressTitle")}</h2>
                <p className="mt-1 text-base text-ink/70">{fullAddress}</p>
                <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-charcoal-600/8 px-3 py-1 text-xs font-semibold text-charcoal-600/80">
                  <Bike size={13} aria-hidden="true" />
                  {t("hoursNote")}
                </p>
              </div>
            </section>

            {/* Do we deliver to you? */}
            <section className="rounded-3xl bg-charcoal-800 p-6 text-cream-100 sm:p-7">
              <h2 className="font-display text-lg font-semibold text-cream-50">{t("deliveryCheckTitle")}</h2>
              <p className="mt-2 text-sm leading-relaxed text-cream-200/70">{t("deliveryCheckText")}</p>
              <DeliveryCheck whatsappHref={whatsappOrderLink(t("deliveryCheckWhatsapp"))} />
            </section>
          </div>

          {/* ---- map + order -------------------------------------------- */}
          <div className="min-w-0">
            <div className="lg:sticky lg:top-24">
              <DeliveryMap />
              <Link
                href="/menu"
                className="mt-4 flex items-center justify-center gap-2.5 rounded-full bg-ember-600 px-6 py-4 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-ember-800/25 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
              >
                <ShoppingBag size={18} />
                {tCommon("orderNow")}
              </Link>
            </div>
          </div>
        </div>

        {/* ---- socials + company ------------------------------------------ */}
        <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-cream-50 p-6 ring-1 ring-charcoal-600/8 sm:flex-row sm:items-center sm:justify-between sm:p-7">
          <div className="flex items-center gap-4">
            <h2 className="font-display text-lg font-semibold text-charcoal-600">{t("socialsTitle")}</h2>
            <div className="flex gap-2">
              {[
                { href: siteConfig.socials.instagram, label: "Instagram", icon: <Instagram size={17} /> },
                { href: siteConfig.socials.facebook, label: "Facebook", icon: <Facebook size={17} /> },
                { href: siteConfig.socials.tiktok, label: "TikTok", icon: <Music2 size={17} /> },
              ].map((s) => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-charcoal-600/8 text-charcoal-600 transition-colors hover:bg-ember-600 hover:text-cream-50"
                >
                  {s.icon}
                </a>
              ))}
            </div>
            <span className="hidden text-sm text-ink/50 sm:inline">{siteConfig.socials.handle}</span>
          </div>
          <p className="text-xs text-ink/50">
            {siteConfig.brandName} · {tFooter("kvk")} {siteConfig.kvkNumber}
            {settings.vatNumber ? ` · ${tFooter("vatId")} ${settings.vatNumber}` : ""}
          </p>
        </div>
      </div>

      <FeedbackCta locale={locale} source="contact" />
    </div>
  );
}
