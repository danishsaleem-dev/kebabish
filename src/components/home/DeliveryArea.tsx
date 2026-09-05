import { getTranslations } from "next-intl/server";
import { MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site-config";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import DeliveryMap from "@/components/home/DeliveryMap";

export default async function DeliveryArea({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
      <div className="grid items-center gap-14 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <SectionEyebrow>{t("home.deliveryEyebrow")}</SectionEyebrow>

          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] sm:text-4xl lg:text-[2.75rem]"
          >
            <MaskedWords text={t("home.deliveryTitle")} />
          </h2>

          <p
            data-reveal
            className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-ink/70 sm:text-lg"
          >
            {t("home.deliveryText")}
          </p>

          {/* Every town is already pinned on the map opposite; these exist
              so the names are also present as plain crawlable text. */}
          <div data-reveal className="mt-7">
            <p className="text-sm font-semibold text-ink/75">
              {t("home.deliveryTownsLabel")}
            </p>
            <ul className="mt-3 flex flex-wrap gap-2">
              {siteConfig.deliveryAreaTowns.map((town) => (
                <li
                  key={town.name}
                  className="inline-flex items-center gap-1.5 rounded-full border border-charcoal-600/15 bg-cream-100 px-3.5 py-1.5 text-sm font-medium text-charcoal-600/85 transition-colors duration-300 hover:border-ember-600/40 hover:text-charcoal-600"
                >
                  <MapPin
                    size={13}
                    aria-hidden="true"
                    className="shrink-0 text-ember-600/70"
                  />
                  {town.name}
                </li>
              ))}
            </ul>
          </div>

          <Link
            data-reveal
            href="/contact"
            className="mt-8 inline-flex items-center gap-2.5 rounded-full bg-charcoal-600 px-8 py-4 font-display text-sm font-semibold text-cream-100 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-ember-600"
          >
            <MapPin size={18} />
            {t("home.deliveryCta")}
          </Link>
        </div>

        <div data-reveal="scale" className="mx-auto w-full max-w-xl">
          <DeliveryMap />
        </div>
      </div>
    </section>
  );
}
