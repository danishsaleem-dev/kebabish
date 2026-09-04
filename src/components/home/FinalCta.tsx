import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { MessageCircle, Phone, UtensilsCrossed } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";

export default async function FinalCta({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });
  const whatsappHref = whatsappOrderLink(t("whatsapp.orderGeneric"));

  return (
    <section className="relative overflow-hidden bg-ember-600">
      <div className="absolute inset-0 bg-[linear-gradient(135deg,#8c401d_0%,#a95026_45%,#c9713e_100%)]" />
      <div className="grain absolute inset-0" />

      {/* Oversized logo watermark, bled off the right edge. */}
      <Image
        src="/logo/kebabish-dark.png"
        alt=""
        aria-hidden="true"
        width={880}
        height={660}
        className="pointer-events-none absolute -right-16 -top-10 hidden w-[26rem] opacity-[0.07] lg:block"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-5 py-20 text-center sm:px-6 sm:py-28">
        <h2
          data-reveal-mask
          className="text-balance font-display text-3xl font-semibold leading-[1.15] text-cream-50 sm:text-4xl lg:text-5xl"
        >
          <MaskedWords text={t("home.ctaBannerTitle")} />
        </h2>

        <p
          data-reveal
          className="mx-auto mt-5 max-w-xl text-pretty text-base leading-relaxed text-cream-100/85 sm:text-lg"
        >
          {t("home.ctaBannerText")}
        </p>

        <div
          data-reveal-group
          className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Link
            data-reveal
            href="/menu"
            className="group inline-flex w-full items-center justify-center gap-2.5 rounded-full bg-cream-100 px-8 py-4 font-display text-sm font-semibold text-charcoal-700 shadow-lg shadow-ember-800/25 transition-[transform,box-shadow] duration-300 hover:-translate-y-0.5 hover:shadow-xl sm:w-auto"
          >
            <UtensilsCrossed
              size={18}
              className="transition-transform duration-300 group-hover:rotate-12"
            />
            {t("common.viewMenu")}
          </Link>

          <a
            data-reveal
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-full border border-cream-100/45 px-8 py-4 font-display text-sm font-semibold text-cream-50 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-cream-100/15 sm:w-auto"
          >
            <MessageCircle size={18} />
            {t("common.whatsappUs")}
          </a>
        </div>

        <a
          data-reveal
          href={`tel:${siteConfig.contact.phone}`}
          className="link-underline mt-9 inline-flex items-center gap-2 text-sm font-medium text-cream-100/80"
        >
          <Phone size={15} />
          {siteConfig.contact.phone}
        </a>
      </div>
    </section>
  );
}
