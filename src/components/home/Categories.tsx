import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicCategories } from "@/lib/public-menu";
import MaskedWords from "@/components/motion/MaskedWords";
import SectionEyebrow from "@/components/home/SectionEyebrow";
import BrandLogo from "@/components/shared/BrandLogo";

/**
 * The menu's categories as photographic cards, linking into the menu page's
 * own category anchors.
 *
 * Every card is the same component at two sizes rather than two components:
 * the first tile spans two columns on a wide screen, which gives the grid an
 * editorial rhythm instead of a uniform row of boxes, and the rest fall in
 * beside it whatever number Danish ends up with. Categories come from the
 * store, so adding one in /admin puts it here with no code change — and one
 * with no photo of its own borrows a dish's (see getPublicCategories) rather
 * than rendering an empty frame.
 */
export default async function Categories({ locale }: { locale: string }) {
  const t = await getTranslations({ locale });
  const categories = await getPublicCategories(locale);

  // Nothing to browse yet (a blank-slate menu) — the section would be an
  // empty promise, so it simply isn't there.
  if (categories.length === 0) return null;

  return (
    <section className="mx-auto max-w-6xl px-5 py-20 sm:px-6 sm:py-28 lg:py-32">
      <div className="flex flex-wrap items-end justify-between gap-6">
        <div className="max-w-2xl">
          <SectionEyebrow>{t("home.categoriesEyebrow")}</SectionEyebrow>
          <h2
            data-reveal-mask
            className="mt-5 text-balance font-display text-3xl font-semibold leading-[1.15] text-charcoal-600 sm:text-4xl lg:text-[2.75rem]"
          >
            <MaskedWords text={t("home.categoriesTitle")} />
          </h2>
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

      <div
        data-reveal-group
        className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3"
      >
        {categories.map((category, i) => (
          <Link
            key={category.id}
            data-reveal
            href={`/menu#${category.id}`}
            className={`group relative isolate flex min-h-56 overflow-hidden rounded-[1.5rem] bg-charcoal-800 ring-1 ring-charcoal-950/10 transition-[translate,box-shadow] duration-500 ease-brand hover:-translate-y-1.5 hover:shadow-2xl hover:shadow-charcoal-950/20 sm:min-h-64 ${
              i === 0 ? "lg:col-span-2 lg:min-h-80" : ""
            }`}
          >
            {category.image ? (
              <Image
                src={category.image}
                alt=""
                fill
                sizes={
                  i === 0
                    ? "(min-width: 1024px) 60vw, (min-width: 640px) 50vw, 92vw"
                    : "(min-width: 1024px) 30vw, (min-width: 640px) 50vw, 92vw"
                }
                className="object-cover transition-transform duration-[900ms] ease-brand group-hover:scale-[1.07]"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-[linear-gradient(135deg,var(--color-charcoal-800),var(--color-charcoal-950))]">
                <BrandLogo
                  src="/logo/kebabish-dark.png"
                  alt=""
                  width={260}
                  height={195}
                  className="h-auto w-24 opacity-20"
                />
              </div>
            )}

            {/* Two gradients: a base that always keeps the label legible, and
                a deeper one that fades in on hover so the type gains contrast
                exactly as the photo starts moving behind it. */}
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/85 via-charcoal-950/25 to-transparent" />
            <div className="absolute inset-0 bg-gradient-to-t from-charcoal-950/90 via-charcoal-950/45 to-charcoal-950/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

            <div className="relative z-10 mt-auto flex w-full items-end justify-between gap-4 p-5 sm:p-6">
              <div className="min-w-0">
                <h3
                  className={`font-display font-semibold text-cream-50 ${
                    i === 0 ? "text-2xl sm:text-3xl" : "text-xl sm:text-2xl"
                  }`}
                >
                  {category.label}
                </h3>
                <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-cream-200/70">
                  {t("home.categoriesCount", { count: category.itemCount })}
                </p>
                {/* The ember rule draws itself in from the left on hover —
                    the same motion language as the link underlines. */}
                <span
                  aria-hidden="true"
                  className="mt-3 block h-px w-0 bg-ember-500 transition-[width] duration-500 ease-brand group-hover:w-14"
                />
              </div>

              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-cream-100/25 bg-charcoal-950/40 text-cream-50 backdrop-blur-sm transition-[background-color,color,translate] duration-500 ease-brand group-hover:-translate-y-0.5 group-hover:bg-ember-600 group-hover:text-cream-50"
              >
                <ArrowUpRight size={18} />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
