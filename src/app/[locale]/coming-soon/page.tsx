import type { Metadata } from "next";
import BrandLogo from "@/components/shared/BrandLogo";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Instagram, Facebook, Mail, MapPin, MessageCircle, Music2, Phone } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";

/**
 * The public face of the site while the real front-end is gated (see
 * src/proxy.ts). Deliberately standalone — no Header/Footer chrome, since
 * this sits outside the `(site)` route group and its nav would just point
 * at pages visitors can't reach yet.
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "comingSoon" });
  return { title: t("title") };
}

const SOCIALS = [
  { href: siteConfig.socials.instagram, label: "Instagram", Icon: Instagram },
  { href: siteConfig.socials.facebook, label: "Facebook", Icon: Facebook },
  { href: siteConfig.socials.tiktok, label: "TikTok", Icon: Music2 },
];

export default async function ComingSoonPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: "comingSoon" });
  const tCommon = await getTranslations({ locale, namespace: "whatsapp" });
  const whatsappHref = whatsappOrderLink(tCommon("orderGeneric"));

  return (
    <div className="grain relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-charcoal-950 px-5 py-16 text-center sm:px-6">
      <div className="absolute inset-0 bg-[radial-gradient(70%_55%_at_50%_0%,rgba(169,80,38,0.25),transparent_70%)]" />

      <div className="relative z-10 w-full max-w-md">
        <LocaleSwitch locale={locale} />

        <BrandLogo
          src="/logo/kebabish-dark.png"
          alt={siteConfig.brandName}
          width={300}
          height={225}
          priority
          className="mx-auto h-28 w-auto"
        />

        <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-cream-200/25 bg-cream-200/10 px-4 py-1.5 text-[0.7rem] font-semibold uppercase tracking-[0.18em] text-cream-200/90 backdrop-blur-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
          {t("eyebrow")}
        </p>

        <h1 className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.1] text-cream-100 sm:text-4xl">
          {t("title")}
        </h1>

        <p className="mx-auto mt-4 max-w-sm text-pretty text-base leading-relaxed text-cream-200/80">
          {t("description")}
        </p>

        <a
          href={whatsappHref}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-8 inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-ember-600 px-8 py-4 text-sm font-semibold text-cream-50 shadow-lg shadow-ember-800/30 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-ember-500 sm:w-auto"
        >
          <MessageCircle size={18} />
          {t("ctaWhatsapp")}
        </a>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs text-cream-200/55">
          <MapPin size={13} />
          {t("deliveryNote")}
        </p>

        <p className="mt-8 text-[0.7rem] font-medium uppercase tracking-[0.16em] text-cream-200/45">
          {t("badge")}
        </p>

        <div className="mt-10 border-t border-cream-200/10 pt-8">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cream-200/50">
            {t("followTitle")}
          </p>
          <div className="mt-3 flex justify-center gap-2.5">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-200/15 text-cream-200/75 transition-colors duration-300 hover:border-ember-500/50 hover:bg-ember-600 hover:text-cream-50"
              >
                <Icon size={17} />
              </a>
            ))}
          </div>

          <p className="mt-6 text-xs font-semibold uppercase tracking-[0.16em] text-cream-200/50">
            {t("contactTitle")}
          </p>
          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-cream-200/80">
            <a
              href={`tel:${siteConfig.contact.phone}`}
              className="inline-flex items-center gap-1.5 hover:text-cream-50"
            >
              <Phone size={14} />
              {siteConfig.contact.phone}
            </a>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="inline-flex items-center gap-1.5 hover:text-cream-50"
            >
              <Mail size={14} />
              {siteConfig.contact.email}
            </a>
          </div>
        </div>

        <p className="mt-10 text-[0.7rem] text-cream-200/35">
          © {new Date().getFullYear()} {siteConfig.brandName}
        </p>
      </div>
    </div>
  );
}

function LocaleSwitch({ locale }: { locale: string }) {
  return (
    <div className="mb-8 flex justify-center">
      <div className="flex items-center overflow-hidden rounded-full border border-cream-100/25 text-xs font-semibold">
        {routing.locales.map((loc) => (
          <Link
            key={loc}
            href="/coming-soon"
            locale={loc}
            aria-label={loc.toUpperCase()}
            className={`px-3 py-1.5 uppercase transition-colors duration-300 ${
              locale === loc
                ? "bg-ember-600 text-cream-50"
                : "text-cream-100/70 hover:text-cream-50"
            }`}
          >
            {loc}
          </Link>
        ))}
      </div>
    </div>
  );
}
