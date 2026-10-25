import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { Quote } from "lucide-react";
import { getSiteMedia } from "@/lib/content/site";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import BrandLogo from "@/components/shared/BrandLogo";

/**
 * "A word from us" — a short note from the family, signed "The Kebabish family"
 * (Danish chose not to put a person's name on it).
 *
 * The text is a draft built only from facts the About page already states, and is
 * editable in Website content → Homepage. The photo is the "A word from us" slot in
 * Website content → Images & videos; nothing ships for it, so until one is picked the
 * arch shows the Kebabish mark instead of a stand-in photo that isn't of the family.
 */
export default async function Founder({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });
  const { founder } = await getSiteMedia();

  return (
    <section className="relative overflow-hidden">
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-20 sm:px-6 sm:py-28 lg:grid-cols-[0.8fr_1.2fr] lg:gap-20 lg:py-32">
        {/* ---- the arch ----------------------------------------------- */}
        <div data-reveal="scale" className="relative isolate mx-auto w-full max-w-sm">
          <div className="absolute -inset-4 -z-10 rounded-t-full bg-[radial-gradient(60%_60%_at_50%_40%,rgba(169,80,38,0.18),transparent_70%)]" />
          {/* Exact radii, not rounded-t-full: an oversized radius makes the browser
              scale every corner down, which flattens the rounded bottom. */}
          <div className="relative aspect-[4/5] overflow-hidden rounded-b-3xl rounded-tl-[50%_40%] rounded-tr-[50%_40%] bg-charcoal-800 shadow-2xl shadow-charcoal-950/25 ring-1 ring-charcoal-600/10">
            {founder.image ? (
              <Image
                src={founder.image}
                alt={t("home.founderPhotoAlt")}
                fill
                sizes="(min-width: 1024px) 24rem, 90vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center bg-[radial-gradient(70%_55%_at_50%_35%,rgba(169,80,38,0.45),transparent_70%)]">
                <BrandLogo
                  src="/logo/kebabish-dark.png"
                  alt=""
                  width={300}
                  height={225}
                  className="h-auto w-48 opacity-95"
                />
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-linear-to-t from-charcoal-950/45 to-transparent" />
          </div>

          {/* The halal seal, pinned to the frame like a sticker. */}
          <Image
            src="/halal.png"
            alt={t("common.halalBadge")}
            width={112}
            height={112}
            sizes="112px"
            className="absolute -right-3 bottom-10 h-24 w-24 rotate-[-10deg] drop-shadow-[0_8px_16px_rgba(20,18,15,0.35)] sm:-right-6 sm:h-28 sm:w-28"
          />
        </div>

        {/* ---- the note ----------------------------------------------- */}
        <div>
          <SectionEyebrow>{t("home.founderEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl lg:text-[2.75rem]"
          >
            <MaskedWords text={t("home.founderTitle")} />
          </h2>

          <figure data-reveal className="relative isolate mt-8">
            <Quote
              aria-hidden="true"
              size={64}
              className="absolute -left-1 -top-12 -z-10 text-ember-600/12 sm:-left-12 sm:-top-8"
            />
            <blockquote className="space-y-4 font-display text-lg leading-relaxed text-charcoal-600 sm:text-xl">
              <p className="text-pretty">{t("home.founderText1")}</p>
              <p className="text-pretty">{t("home.founderText2")}</p>
            </blockquote>
            <figcaption className="mt-8 flex items-center gap-4">
              <span aria-hidden="true" className="h-px w-12 bg-ember-600/60" />
              <span className="font-display text-lg font-semibold italic text-ember-700">
                {t("home.founderSign")}
              </span>
            </figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
