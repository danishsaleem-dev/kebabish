import type { Metadata } from "next";
import Image from "next/image";
import { getTranslations, setRequestLocale } from "next-intl/server";
import {
  ArrowUpRight,
  Briefcase,
  Cake,
  CalendarDays,
  Check,
  Flame,
  MapPin,
  MessageCircle,
  Phone,
  ShieldAlert,
  Sparkles,
  Truck,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { pageMetadata } from "@/lib/seo";
import { getPublicCategories, getPublicMenu } from "@/lib/public-menu";
import ServiceSchema from "@/components/schema/ServiceSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import Motion from "@/components/motion/Motion";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import Testimonials from "@/components/home/Testimonials";
import FeedbackCta from "@/components/feedback/FeedbackCta";
import BrandLogo from "@/components/shared/BrandLogo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/catering",
    title: t("cateringTitle"),
    description: t("cateringDescription"),
  });
}

/**
 * Catering — parties, company drinks, family gatherings.
 *
 * Nothing on this page invents an offer: there are no packages, prices per person or
 * minimum numbers, because none have been agreed. What it does instead is make asking
 * easy — the occasions and steps are the page's own copy (`catering.*`), the dishes are
 * the real menu, and the WhatsApp button opens with the four things the kitchen needs to
 * answer (guests, date, address, wishes) already typed out, so a request arrives
 * complete. WhatsApp is the agreed conversation route for catering.
 */
export default async function CateringPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });
  const [categories, menu] = await Promise.all([getPublicCategories(locale), getPublicMenu(locale)]);

  const quickHref = whatsappOrderLink(t("whatsapp.cateringInquiry"));
  const briefHref = whatsappOrderLink(t("whatsapp.cateringDetailed"));
  const phoneHref = `tel:${siteConfig.contact.phone.replace(/[^\d+]/g, "")}`;

  // One photo per category first (three biryanis read as one dish), then the rest.
  const withPhoto = menu.flatMap((c) => c.items.filter((i) => i.image).slice(0, 1));
  const photos = [...withPhoto, ...menu.flatMap((c) => c.items).filter((i) => i.image && !withPhoto.includes(i))]
    .slice(0, 3)
    .map((i) => i.image as string);

  const occasions = [
    { icon: Cake, title: t("catering.occasion1Title"), text: t("catering.occasion1Text") },
    { icon: Briefcase, title: t("catering.occasion2Title"), text: t("catering.occasion2Text") },
    { icon: Users, title: t("catering.occasion3Title"), text: t("catering.occasion3Text") },
    { icon: Sparkles, title: t("catering.occasion4Title"), text: t("catering.occasion4Text") },
  ];
  const steps = [
    { icon: Phone, title: t("catering.step1Title"), text: t("catering.step1Text") },
    { icon: UtensilsCrossed, title: t("catering.step2Title"), text: t("catering.step2Text") },
    { icon: Truck, title: t("catering.step3Title"), text: t("catering.step3Text") },
  ];
  const brief = [
    { icon: Users, text: t("catering.brief1") },
    { icon: CalendarDays, text: t("catering.brief2") },
    { icon: MapPin, text: t("catering.brief3") },
    { icon: ShieldAlert, text: t("catering.brief4") },
  ];
  const plates = [
    { box: "left-[4%] top-[6%] h-[56%] w-[56%]", delay: "0s", rotate: "-rotate-6" },
    { box: "right-[2%] top-[20%] h-[46%] w-[46%]", delay: "-2.2s", rotate: "rotate-6" },
    { box: "bottom-[4%] left-[28%] h-[40%] w-[40%]", delay: "-4.1s", rotate: "-rotate-3" },
  ];

  return (
    <div className="bg-cream-200">
      <Motion />
      <ServiceSchema
        locale={locale}
        path="/catering"
        name={t("seo.cateringServiceName")}
        serviceType={t("seo.cateringServiceType")}
        description={t("seo.cateringDescription")}
      />
      <BreadcrumbSchema locale={locale} items={[{ name: t("catering.title"), path: "/catering" }]} />

      {/* ---- hero ------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-charcoal-900 text-cream-100">
        <div className="absolute inset-0 bg-[radial-gradient(60%_60%_at_80%_40%,rgba(169,80,38,0.34),transparent_70%),radial-gradient(40%_50%_at_0%_100%,rgba(169,80,38,0.18),transparent_70%)]" />
        <div className="grain absolute inset-0 opacity-70" />

        <div className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-6 sm:pb-20 sm:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14">
          <div>
            <SectionEyebrow tone="light">{t("catering.title")}</SectionEyebrow>
            <h1
              data-reveal-mask
              className="mt-5 text-balance font-display text-4xl font-semibold leading-[1.08] text-cream-50 sm:text-5xl"
            >
              <MaskedWords text={t("catering.intro")} />
            </h1>
            <p data-reveal className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream-200/75 sm:text-lg">
              {t("catering.introText")}
            </p>

            <div data-reveal className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a
                href={quickHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-ember-600 px-7 py-4 font-display text-sm font-semibold text-cream-50 shadow-lg shadow-ember-900/30 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
              >
                <MessageCircle size={18} />
                {t("catering.ctaWhatsapp")}
              </a>
              <a
                href={phoneHref}
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-cream-100/25 px-7 py-4 font-display text-sm font-semibold text-cream-50 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-cream-100/10"
              >
                <Phone size={18} />
                {t("catering.ctaCall")}
              </a>
            </div>

            <ul data-reveal className="mt-8 flex flex-wrap gap-2">
              {[
                { icon: <Flame size={14} aria-hidden="true" className="text-ember-400" />, text: t("item.freshTitle") },
                {
                  icon: <Image src="/halal.png" alt="" width={16} height={16} sizes="16px" className="h-4 w-4" />,
                  text: t("common.halalBadge"),
                },
                {
                  icon: <Truck size={14} aria-hidden="true" className="text-ember-400" />,
                  text: t("item.deliveredShortTitle", { km: siteConfig.deliveryRadiusKm }),
                },
              ].map((f) => (
                <li
                  key={f.text}
                  className="inline-flex items-center gap-1.5 rounded-full bg-cream-50/[0.07] px-3.5 py-1.5 text-xs font-semibold text-cream-100/90 ring-1 ring-cream-100/10"
                >
                  {f.icon}
                  {f.text}
                </li>
              ))}
            </ul>
          </div>

          {/* Floating plates — the menu's own photos. */}
          <div aria-hidden="true" className="relative mx-auto aspect-square w-full max-w-sm sm:max-w-md lg:max-w-none">
            <div className="absolute inset-[12%] rounded-full border border-dashed border-cream-100/15" />
            <div className="absolute inset-[26%] rounded-full bg-ember-600/25 blur-3xl" />
            {photos.length > 0 ? (
              photos.map((src, i) => (
                <div key={src} className={`catering-float absolute ${plates[i].box}`} style={{ animationDelay: plates[i].delay }}>
                  <div className={`relative h-full w-full overflow-hidden rounded-full shadow-2xl shadow-charcoal-950/60 ring-[6px] ring-cream-100/90 ${plates[i].rotate}`}>
                    <Image src={src} alt="" fill sizes="(min-width: 1024px) 18rem, 50vw" className="object-cover" />
                  </div>
                </div>
              ))
            ) : (
              <div className="absolute inset-[22%] flex items-center justify-center">
                <BrandLogo src="/logo/kebabish-dark.png" alt="" width={300} height={225} className="h-auto w-40 opacity-90" />
              </div>
            )}
            <span className="absolute bottom-[12%] right-[4%] rounded-full bg-cream-50 px-4 py-2 font-display text-xs font-semibold text-charcoal-700 shadow-xl">
              {t("home.cateringBadge")}
            </span>
          </div>
        </div>
      </section>

      {/* ---- occasions --------------------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
        <div className="max-w-2xl">
          <SectionEyebrow>{t("catering.occasionsEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
          >
            <MaskedWords text={t("catering.occasionsTitle")} />
          </h2>
        </div>
        <ul data-reveal-group className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          {occasions.map(({ icon: Icon, title, text }) => (
            <li
              key={title}
              data-reveal
              className="group rounded-3xl bg-cream-50 p-6 ring-1 ring-charcoal-600/8 transition-[translate,box-shadow] duration-500 ease-brand hover:-translate-y-1 hover:shadow-xl hover:shadow-charcoal-950/8"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600 transition-[background-color,color,transform] duration-500 group-hover:-rotate-6 group-hover:bg-ember-600 group-hover:text-cream-50">
                <Icon size={21} />
              </span>
              <h3 className="mt-5 font-display text-lg font-semibold text-charcoal-600">{title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink/60">{text}</p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- how it works --------------------------------------------------------- */}
      <section className="grain bg-cream-100 py-16 sm:py-24">
        <div className="relative z-10 mx-auto max-w-6xl px-5 sm:px-6">
          <div className="max-w-2xl">
            <SectionEyebrow>{t("catering.stepsEyebrow")}</SectionEyebrow>
            <h2
              data-reveal-mask
              className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
            >
              <MaskedWords text={t("catering.stepsTitle")} />
            </h2>
          </div>
          <ol data-reveal-group className="relative mt-12 grid gap-8 sm:grid-cols-3 sm:gap-6">
            <span
              aria-hidden="true"
              className="absolute left-[calc(16.66%)] right-[calc(16.66%)] top-7 hidden h-0.5 rounded-full bg-linear-to-r from-ember-400 via-ember-500 to-ember-600 sm:block"
            />
            {steps.map(({ icon: Icon, title, text }, i) => (
              <li key={title} data-reveal className="relative flex gap-4 sm:flex-col sm:items-center sm:text-center">
                <span className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-charcoal-700 text-cream-50 shadow-lg shadow-charcoal-950/20 ring-4 ring-cream-100">
                  <Icon size={22} aria-hidden="true" />
                  <span className="absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-ember-600 text-xs font-bold text-cream-50 ring-2 ring-cream-100">
                    {i + 1}
                  </span>
                </span>
                <span>
                  <h3 className="font-display text-lg font-semibold text-charcoal-600 sm:mt-5">{title}</h3>
                  <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-ink/60">{text}</p>
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- compose from the menu ------------------------------------------------ */}
      {categories.length > 0 && (
        <section className="mx-auto max-w-6xl px-5 py-16 sm:px-6 sm:py-24">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="max-w-2xl">
              <SectionEyebrow>{t("catering.menuEyebrow")}</SectionEyebrow>
              <h2
                data-reveal-mask
                className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl"
              >
                <MaskedWords text={t("catering.menuTitle")} />
              </h2>
              <p data-reveal className="mt-4 text-pretty text-base leading-relaxed text-ink/65">
                {t("catering.menuText")}
              </p>
            </div>
            <Link
              data-reveal
              href="/menu"
              className="link-underline inline-flex items-center gap-2 font-display text-sm font-semibold text-ember-600"
            >
              {t("home.categoriesCta")}
              <ArrowUpRight size={16} />
            </Link>
          </div>
          <ul data-reveal-group className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {categories.map((c) => (
              <li key={c.id} data-reveal>
                <Link
                  href={`/menu#${c.id}`}
                  className="group relative block aspect-[4/3] overflow-hidden rounded-3xl bg-charcoal-800"
                >
                  {c.image && (
                    <Image
                      src={c.image}
                      alt=""
                      fill
                      sizes="(min-width: 1024px) 25vw, 50vw"
                      className="object-cover opacity-85 transition-transform duration-700 ease-brand group-hover:scale-[1.06]"
                    />
                  )}
                  <span className="absolute inset-0 bg-linear-to-t from-charcoal-950/85 via-charcoal-950/20 to-transparent" />
                  <span className="absolute inset-x-4 bottom-3.5 flex items-end justify-between gap-2">
                    <span className="font-display text-base font-semibold leading-tight text-cream-50 sm:text-lg">{c.label}</span>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-cream-50/90 text-charcoal-700 transition-[background-color,color,transform] duration-300 group-hover:rotate-45 group-hover:bg-ember-600 group-hover:text-cream-50">
                      <ArrowUpRight size={15} />
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ---- the request, ready to send ------------------------------------------- */}
      <section className="mx-auto max-w-6xl px-5 pb-16 sm:px-6 sm:pb-24">
        <div
          data-reveal="scale"
          className="relative overflow-hidden rounded-[2rem] bg-charcoal-800 p-6 text-cream-100 sm:p-10"
        >
          <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_100%_0%,rgba(169,80,38,0.35),transparent_70%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <p className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-ember-400">{t("catering.briefEyebrow")}</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-cream-50 sm:text-3xl">{t("catering.briefTitle")}</h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-cream-200/70 sm:text-base">{t("catering.briefText")}</p>
              <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                {brief.map(({ icon: Icon, text }) => (
                  <li key={text} className="flex items-center gap-3 rounded-2xl bg-cream-50/[0.06] px-4 py-3 text-sm font-semibold">
                    <Icon size={17} aria-hidden="true" className="shrink-0 text-ember-400" />
                    {text}
                    <Check size={15} aria-hidden="true" className="ml-auto text-success" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-3 lg:w-72">
              <a
                href={briefHref}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2.5 rounded-full bg-[#25D366] px-7 py-4 font-display text-sm font-semibold text-white shadow-lg shadow-charcoal-950/30 transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5"
              >
                <MessageCircle size={18} />
                {t("catering.briefCta")}
              </a>
              <a
                href={phoneHref}
                className="inline-flex items-center justify-center gap-2.5 rounded-full border border-cream-100/25 px-7 py-4 font-display text-sm font-semibold text-cream-50 transition-colors hover:bg-cream-100/10"
              >
                <Phone size={18} />
                {siteConfig.contact.phone}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ---- what customers say (nothing until there are reviews) --------------- */}
      <Testimonials locale={locale} />

      <FeedbackCta locale={locale} />
    </div>
  );
}
