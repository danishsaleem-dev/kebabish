import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MessageCircle, Phone, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";

/**
 * The closing call to action — a slim ember band: the question and one line on the
 * left, the buttons on the right (stacked on a phone). It used to be a full-height
 * centred block; at this point of the page the visitor has seen everything and only
 * needs the buttons, so it no longer spends a screen saying so.
 */
export default async function FinalCta({
  locale,
  isOpen,
}: {
  locale: string;
  isOpen: boolean;
}) {
  const t = await getTranslations({ locale });
  const whatsappHref = whatsappOrderLink(t("whatsapp.orderGeneric"));

  return (
    <section className="relative overflow-hidden bg-ember-600">
      <div className="absolute inset-0 bg-[linear-gradient(120deg,#8c401d_0%,#a95026_50%,#c9713e_100%)]" />
      <div className="grain absolute inset-0" />

      {/* Logo watermark, bled off the right edge. */}
      <Image
        src="/logo/kebabish-dark.png"
        alt=""
        aria-hidden="true"
        width={880}
        height={660}
        className="pointer-events-none absolute -right-10 top-1/2 hidden w-[18rem] -translate-y-1/2 opacity-[0.08] lg:block"
      />

      <div
        data-reveal
        className="relative z-10 mx-auto flex max-w-6xl flex-col gap-6 px-5 py-10 sm:px-6 sm:py-12 lg:flex-row lg:items-center lg:justify-between lg:gap-10"
      >
        <div className="max-w-xl">
          <h2 className="text-balance font-display text-2xl font-semibold leading-tight text-cream-50 sm:text-3xl">
            {t("home.ctaBannerTitle")}
          </h2>
          <p className="mt-2 text-pretty text-sm leading-relaxed text-cream-100/85 sm:text-base">
            {t("home.ctaBannerText")}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center lg:shrink-0">
          <Link
            href="/menu"
            className="group inline-flex items-center justify-center gap-2.5 rounded-full bg-cream-100 px-7 py-3.5 font-display text-sm font-semibold text-charcoal-700 shadow-lg shadow-ember-800/25 transition-[translate,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl"
          >
            <UtensilsCrossed
              size={17}
              className="transition-transform duration-300 group-hover:rotate-12"
            />
            {t("common.viewMenu")}
          </Link>

          {isOpen ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2.5 rounded-full border border-cream-100/45 px-7 py-3.5 font-display text-sm font-semibold text-cream-50 transition-[background-color,translate] duration-300 hover:-translate-y-0.5 hover:bg-cream-100/15"
            >
              <MessageCircle size={17} />
              {t("common.whatsappUs")}
            </a>
          ) : (
            <span className="inline-flex cursor-default items-center justify-center gap-2.5 rounded-full border border-cream-100/20 px-7 py-3.5 font-display text-sm font-semibold text-cream-50/50">
              <MessageCircle size={17} />
              {t("common.closedNow")}
            </span>
          )}

          <a
            href={`tel:${siteConfig.contact.phone}`}
            aria-label={`${t("common.callUs")} ${siteConfig.contact.phone}`}
            className="inline-flex items-center justify-center gap-2 rounded-full px-3 py-2 text-sm font-medium text-cream-100/85 transition-colors hover:text-cream-50"
          >
            <Phone size={15} />
            <span className="sm:hidden lg:inline">{siteConfig.contact.phone}</span>
          </a>
        </div>
      </div>
    </section>
  );
}
