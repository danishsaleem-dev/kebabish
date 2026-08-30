import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Utensils, Leaf, Clock, Smartphone, MessageCircle } from "lucide-react";
import { findMenuItem } from "@/lib/menu-data";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import MenuItemCard from "@/components/MenuItemCard";

const POPULAR_SLUGS = [
  "chicken-biryani",
  "chicken-chapli-kebab",
  "zinger-burger",
  "chicken-shoarma",
  "qeema-naan",
  "milk-shake",
];

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale });
  const popularItems = POPULAR_SLUGS.map(findMenuItem).filter((i) => i != null);

  const whatsappHref = whatsappOrderLink(
    locale === "nl"
      ? "Hallo Kebabish! Ik wil graag een bestelling plaatsen."
      : "Hi Kebabish! I'd like to place an order."
  );

  const whyItems = [
    { icon: Utensils, title: t("home.why1Title"), text: t("home.why1Text") },
    { icon: Leaf, title: t("home.why2Title"), text: t("home.why2Text") },
    { icon: Clock, title: t("home.why3Title"), text: t("home.why3Text") },
    { icon: Smartphone, title: t("home.why4Title"), text: t("home.why4Text") },
  ];

  return (
    <>
      {/* HERO */}
      <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-neutral-900 text-neutral-50">
        {/* TODO: swap for the sourced "desi food making" stock video.
            <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-40">
              <source src="/videos/hero-cooking.mp4" type="video/mp4" />
            </video>
        */}
        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <span className="inline-block rounded-full bg-neutral-50/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {t("hero.eyebrow")}
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-4 text-xl text-neutral-400 sm:text-2xl">
            {t("hero.subtitle")}
          </p>
          <p className="mx-auto mt-5 max-w-xl text-base text-neutral-50/90 sm:text-lg">
            {t("hero.description")}
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/menu"
              className="w-full rounded-full bg-neutral-50 px-7 py-3.5 text-center text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-200 sm:w-auto"
            >
              {t("hero.ctaOrder")}
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-50/30 bg-neutral-50/10 px-7 py-3.5 text-sm font-semibold text-neutral-50 transition-colors hover:bg-neutral-50/20 sm:w-auto"
            >
              <MessageCircle size={18} />
              {t("hero.ctaWhatsapp")}
            </a>
          </div>

          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-neutral-50/70">
            {t("hero.badge")}
          </p>
        </div>
      </section>

      {/* ABOUT */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-neutral-900">
          {t("home.aboutEyebrow")}
        </span>
        <h2 className="mt-3 text-3xl font-semibold text-neutral-900 sm:text-4xl">
          {t("home.aboutTitle")}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-neutral-900/85 sm:text-lg">
          {t("home.aboutText")}
        </p>
      </section>

      {/* POPULAR DISHES */}
      <section className="bg-neutral-200/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-neutral-900">
              {t("home.popularEyebrow")}
            </span>
            <h2 className="mt-3 text-3xl font-semibold text-neutral-900 sm:text-4xl">
              {t("home.popularTitle")}
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {popularItems.map((item) => (
              <MenuItemCard key={item.slug} item={item} />
            ))}
          </div>

          <div className="mt-10 text-center">
            <Link
              href="/menu"
              className="inline-block rounded-full border border-neutral-900 px-7 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-neutral-50"
            >
              {t("home.popularCta")}
            </Link>
          </div>
        </div>
      </section>

      {/* WHY KEBABISH */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-900">
            {t("home.whyEyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold text-neutral-900 sm:text-4xl">
            {t("home.whyTitle")}
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyItems.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-neutral-200 bg-white/50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-neutral-900/10 text-neutral-900">
                <Icon size={22} />
              </div>
              <p className="mt-4 text-lg font-semibold text-neutral-900">{title}</p>
              <p className="mt-2 text-sm text-neutral-900/75">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DELIVERY AREA */}
      <section className="bg-neutral-900 py-20 text-neutral-50">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
            {t("home.deliveryEyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
            {t("home.deliveryTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-neutral-50/85">
            {t("home.deliveryText")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {siteConfig.deliveryAreaTowns.map((town) => (
              <span key={town} className="rounded-full bg-neutral-50/10 px-3 py-1 text-xs font-medium">
                {town}
              </span>
            ))}
          </div>
          <Link
            href="/contact"
            className="mt-8 inline-block rounded-full bg-neutral-400 px-7 py-3.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-500"
          >
            {t("home.deliveryCta")}
          </Link>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="text-2xl font-semibold text-neutral-900 sm:text-3xl">
          {t("home.ctaBannerTitle")}
        </h2>
        <p className="mt-3 text-base text-neutral-900/80">{t("home.ctaBannerText")}</p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/menu"
            className="w-full rounded-full bg-neutral-900 px-7 py-3.5 text-center text-sm font-semibold text-neutral-50 transition-colors hover:bg-neutral-800 sm:w-auto"
          >
            {t("common.viewMenu")}
          </Link>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-neutral-900 px-7 py-3.5 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-900 hover:text-neutral-50 sm:w-auto"
          >
            <MessageCircle size={18} />
            {t("common.whatsappUs")}
          </a>
        </div>
      </section>
    </>
  );
}
