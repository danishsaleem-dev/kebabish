import { getTranslations } from "next-intl/server";
import { getMediaByIds, getPublicSettings } from "@/lib/admin/store";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import ShowcaseGrid, { type ShowcasePhoto } from "@/components/home/ShowcaseGrid";

/**
 * The photo showcase, filled from the media library in /admin (Settings →
 * Homepage photos). The ids are an ordered list, so the order Danish drags
 * them into is the order they appear in.
 *
 * It renders nothing at all until he picks some: an empty or half-filled
 * gallery of placeholders says less about the food than no gallery does. The
 * same reason the reviews block stays absent until there are real reviews.
 */
export default async function Showcase({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });

  let photos: ShowcasePhoto[] = [];
  try {
    const settings = await getPublicSettings();
    const ids = settings.galleryMediaIds ?? [];
    if (ids.length === 0) return null;

    const media = await getMediaByIds(ids);
    // getMediaByIds answers "which of these exist"; re-order to the ids so a
    // deleted image drops out without shuffling the rest.
    const byId = new Map(media.map((m) => [m.id, m]));
    photos = ids.flatMap((id) => {
      const found = byId.get(id);
      return found
        ? [{ id: found.id, url: found.url, alt: found.alt, width: found.width, height: found.height }]
        : [];
    });
  } catch (error) {
    // The storefront never goes down over a decorative section.
    console.error("[home] could not load the showcase gallery:", error);
    return null;
  }

  if (photos.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
      <div className="max-w-2xl">
        <SectionEyebrow>{t("home.showcaseEyebrow")}</SectionEyebrow>
        <h2
          data-reveal-mask
          className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl lg:text-[2.75rem]"
        >
          <MaskedWords text={t("home.showcaseTitle")} />
        </h2>
        <p data-reveal className="mt-5 text-pretty text-base leading-relaxed text-ink/70 sm:text-lg">
          {t("home.showcaseText")}
        </p>
      </div>

      <div className="mt-12">
        <ShowcaseGrid photos={photos} />
      </div>
    </section>
  );
}
