import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import DeliveryAddressStatus from "@/components/location/DeliveryAddressStatus";
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

          {/* The towns used to be listed here as chips as well — a second copy
              of the names the map opposite already pins (its labels are real
              text, so they stay crawlable). Instead: the answer to "do you
              deliver to me?", using the address this device already gave. */}
          <div data-reveal className="mt-8">
            <DeliveryAddressStatus checkLabel={t("home.deliveryCta")} />
          </div>

          <Link
            data-reveal
            href="/delivery-areas"
            className="link-underline mt-6 inline-flex items-center gap-2 font-display text-sm font-semibold text-ember-600"
          >
            {t("home.deliveryAreasLink")}
            <ArrowUpRight size={16} />
          </Link>
        </div>

        <div data-reveal="scale" className="mx-auto w-full max-w-xl">
          <DeliveryMap />
        </div>
      </div>
    </section>
  );
}
