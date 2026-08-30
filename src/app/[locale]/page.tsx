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
      <section className="relative flex min-h-[92vh] items-center overflow-hidden bg-maroon text-cream">
        {/* TODO: swap for the sourced "desi food making" stock video.
            <video autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-40">
              <source src="/videos/hero-cooking.mp4" type="video/mp4" />
            </video>
        */}
        <div
          className="absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(circle at 20% 20%, var(--color-terracotta) 0%, transparent 45%), radial-gradient(circle at 80% 80%, var(--color-mustard) 0%, transparent 40%), var(--color-maroon)",
          }}
        />
        <div className="absolute inset-0 bg-maroon/40" />

        <div className="relative mx-auto max-w-4xl px-4 py-24 text-center sm:px-6">
          <span className="inline-block rounded-full bg-cream/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-mustard">
            {t("hero.eyebrow")}
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold leading-tight sm:text-5xl md:text-6xl">
            {t("hero.title")}
          </h1>
          <p className="mt-4 font-display text-xl text-mustard sm:text-2xl">
            {t("hero.subtitle")}
          </p>
          <p className="mx-auto mt-5 max-w-xl text-base text-cream/90 sm:text-lg">
            {t("hero.description")}
          </p>

          <div className="mt-9 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/menu"
              className="w-full rounded-full bg-terracotta px-7 py-3.5 text-center text-sm font-semibold text-cream transition-colors hover:bg-terracotta-dark sm:w-auto"
            >
              {t("hero.ctaOrder")}
            </Link>
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-cream/30 bg-cream/10 px-7 py-3.5 text-sm font-semibold text-cream transition-colors hover:bg-cream/20 sm:w-auto"
            >
              <MessageCircle size={18} />
              {t("hero.ctaWhatsapp")}
            </a>
          </div>

          <p className="mt-6 text-xs font-medium uppercase tracking-wide text-cream/70">
            {t("hero.badge")}
          </p>
        </div>
      </section>

      {/* ABOUT */}
      <section className="mx-auto max-w-4xl px-4 py-20 text-center sm:px-6">
        <span className="text-xs font-semibold uppercase tracking-wide text-terracotta">
          {t("home.aboutEyebrow")}
        </span>
        <h2 className="mt-3 font-display text-3xl font-semibold text-maroon sm:text-4xl">
          {t("home.aboutTitle")}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-charcoal/85 sm:text-lg">
          {t("home.aboutText")}
        </p>
      </section>

      {/* POPULAR DISHES */}
      <section className="bg-cream-dark/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <span className="text-xs font-semibold uppercase tracking-wide text-terracotta">
              {t("home.popularEyebrow")}
            </span>
            <h2 className="mt-3 font-display text-3xl font-semibold text-maroon sm:text-4xl">
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
              className="inline-block rounded-full border border-maroon px-7 py-3 text-sm font-semibold text-maroon transition-colors hover:bg-maroon hover:text-cream"
            >
              {t("home.popularCta")}
            </Link>
          </div>
        </div>
      </section>

      {/* WHY KEBABISH */}
      <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
        <div className="text-center">
          <span className="text-xs font-semibold uppercase tracking-wide text-terracotta">
            {t("home.whyEyebrow")}
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold text-maroon sm:text-4xl">
            {t("home.whyTitle")}
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {whyItems.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-2xl border border-cream-dark bg-white/50 p-6 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-terracotta/10 text-terracotta">
                <Icon size={22} />
              </div>
              <p className="mt-4 font-display text-lg font-semibold text-maroon">{title}</p>
              <p className="mt-2 text-sm text-charcoal/75">{text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* DELIVERY AREA */}
      <section className="bg-maroon py-20 text-cream">
        <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
          <span className="text-xs font-semibold uppercase tracking-wide text-mustard">
            {t("home.deliveryEyebrow")}
          </span>
          <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">
            {t("home.deliveryTitle")}
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-cream/85">
            {t("home.deliveryText")}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {siteConfig.deliveryAreaTowns.map((town) => (
              <span key={town} className="rounded-full bg-cream/10 px-3 py-1 text-xs font-medium">
                {town}
              </span>
            ))}
          </div>
          <Link
            href="/contact"
            className="mt-8 inline-block rounded-full bg-mustard px-7 py-3.5 text-sm font-semibold text-maroon transition-colors hover:bg-mustard-dark"
          >
            {t("home.deliveryCta")}
          </Link>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6">
        <h2 className="font-display text-2xl font-semibold text-maroon sm:text-3xl">
          {t("home.ctaBannerTitle")}
        </h2>
        <p className="mt-3 text-base text-charcoal/80">{t("home.ctaBannerText")}</p>
        <div className="mt-7 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/menu"
            className="w-full rounded-full bg-terracotta px-7 py-3.5 text-center text-sm font-semibold text-cream transition-colors hover:bg-terracotta-dark sm:w-auto"
          >
            {t("common.viewMenu")}
          </Link>
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-maroon px-7 py-3.5 text-sm font-semibold text-maroon transition-colors hover:bg-maroon hover:text-cream sm:w-auto"
          >
            <MessageCircle size={18} />
            {t("common.whatsappUs")}
          </a>
        </div>
      </section>
    </>
  );
}
