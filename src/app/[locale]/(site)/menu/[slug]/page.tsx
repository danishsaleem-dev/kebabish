import type { Metadata } from "next";
import Image from "next/image";
import BrandLogo from "@/components/shared/BrandLogo";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ArrowLeft, Leaf, Flame } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicItem, getPublicItemSlugs } from "@/lib/public-menu";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { localeAlternates } from "@/lib/seo";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { formatEuro } from "@/lib/money";
import ItemOrderPanel from "@/components/menu/ItemOrderPanel";

export async function generateStaticParams() {
  const slugs = await getPublicItemSlugs();
  return slugs.map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const found = await getPublicItem(slug);
  if (!found) return {};

  const { item } = found;
  // A real description beats the generic fallback as the search snippet;
  // collapse line breaks and stay inside what Google displays (~160).
  const written = item.description.replace(/\s+/g, " ").trim();
  return {
    title: item.name,
    description: written
      ? written.length > 158
        ? `${written.slice(0, 157).trimEnd()}…`
        : written
      : `${item.name} — ${siteConfig.brandName}, ${siteConfig.address.city}.`,
    openGraph: item.image ? { images: [item.image] } : undefined,
    alternates: localeAlternates(locale, `/menu/${slug}`),
  };
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const found = await getPublicItem(slug);
  if (!found) notFound();

  const { item, category } = found;
  const t = await getTranslations({ locale });
  const settings = await getPublicSettings();
  const { isOpen } = getStoreStatus(settings);

  const whatsappHref = whatsappOrderLink(
    item.variants.length
      ? t("whatsapp.orderItemVariant", { item: item.name })
      : t("whatsapp.orderItem", { item: item.name })
  );

  // The 14 statutory allergens have translated names; one Danish added
  // himself has only the label he typed, so that's what it falls back to.
  const allergenLabels = item.allergens.map((a) =>
    t.has(`allergenNames.${a.id}`) ? t(`allergenNames.${a.id}`) : a.label
  );

  const headingProps = {
    item,
    category: category.label,
    vegetarianLabel: t("menu.vegetarian"),
    spicyLabel: t("menu.spicy"),
    priceOnRequestLabel: t("menu.priceOnRequest"),
    soldOutLabel: t("menu.soldOut"),
    allergens: allergenLabels,
    allergensTitle: t("item.allergens"),
    allergensContains: t("item.allergensContains"),
  };

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
      <BreadcrumbSchema
        locale={locale}
        items={[
          { name: t("nav.menu"), path: "/menu" },
          { name: item.name, path: `/menu/${slug}` },
        ]}
      />
      <Link
        href="/menu"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink/60 transition-colors hover:text-charcoal-600"
      >
        <ArrowLeft size={16} />
        {t("item.backToMenu")}
      </Link>

      {/* The heading used to be rendered twice — once per breakpoint — which
          put two <h1>s (and would now put two <h2>s) in the DOM on a page
          where SEO is the priority. Grid placement gets the same layout from
          one copy: the media column spans both rows on desktop, so the
          heading and order panel auto-place beside it. */}
      <div className="mt-8 grid items-start gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="lg:row-span-2">
          <div className="relative aspect-4/3 overflow-hidden rounded-3xl bg-cream-300">
            {item.image ? (
              <Image
                src={item.image}
                alt={item.name}
                fill
                priority
                sizes="(min-width: 1024px) 45vw, 90vw"
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[linear-gradient(135deg,var(--color-cream-300),var(--color-cream-200))]">
                <BrandLogo
                  src="/logo/Kebabish-light.png"
                  alt=""
                  width={260}
                  height={195}
                  className="h-auto w-28 opacity-25"
                />
              </div>
            )}
          </div>

        </div>

        <ItemHeading {...headingProps} />

        <ItemOrderPanel item={item} isOpen={isOpen} whatsappHref={whatsappHref} />
      </div>

      {/* Everything above is what someone needs to actually order. The
          video and the write-up are a separate section underneath, so they
          can't push the price and the order panel down the page. */}
      {(item.videoUrl || item.description) && (
        <section className="mt-14 border-t border-charcoal-600/10 pt-10 sm:mt-16 sm:pt-12">
          <h2 className="font-display text-2xl font-semibold text-charcoal-600">
            {t("item.aboutTitle")}
          </h2>

          <div
            className={`mt-6 grid gap-8 ${
              item.videoUrl && item.description ? "lg:grid-cols-2 lg:gap-12" : ""
            }`}
          >
            {item.videoUrl && (
              // preload="metadata" + #t=0.001 shows the first frame without
              // pulling the whole file, and nothing plays until the customer
              // asks — this page is an SEO/PageSpeed landing page first.
              <video
                src={`${item.videoUrl}#t=0.001`}
                controls
                playsInline
                preload="metadata"
                aria-label={t("item.videoLabel", { item: item.name })}
                className="aspect-video w-full rounded-3xl bg-charcoal-900 object-cover"
              />
            )}

            {item.description && (
              // whitespace-pre-line keeps the line breaks typed in the admin.
              <p className="max-w-2xl whitespace-pre-line text-base leading-relaxed text-ink/75">
                {item.description}
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

function ItemHeading({
  item,
  category,
  vegetarianLabel,
  spicyLabel,
  priceOnRequestLabel,
  soldOutLabel,
  allergens,
  allergensTitle,
  allergensContains,
}: {
  item: Awaited<ReturnType<typeof getPublicItem>> extends null
    ? never
    : NonNullable<Awaited<ReturnType<typeof getPublicItem>>>["item"];
  category: string;
  vegetarianLabel: string;
  spicyLabel: string;
  priceOnRequestLabel: string;
  soldOutLabel: string;
  allergens: string[];
  allergensTitle: string;
  allergensContains: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ember-600">
        {category}
      </p>
      <h1 className="mt-2 text-balance font-display text-3xl font-semibold leading-tight text-charcoal-600 sm:text-4xl">
        {item.name}
      </h1>

      {item.variants.length > 0 && (
        <p className="mt-3 text-base text-ink/60">{item.variants.join(" · ")}</p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2.5">
        <span className="font-display text-2xl font-semibold text-charcoal-600">
          {item.price != null ? formatEuro(item.price) : priceOnRequestLabel}
        </span>

        {item.vegetarian && (
          <Tag>
            <Leaf size={13} aria-hidden="true" />
            {vegetarianLabel}
          </Tag>
        )}
        {item.spicy && (
          <Tag>
            <Flame size={13} aria-hidden="true" />
            {spicyLabel}
          </Tag>
        )}
        {item.soldOut && <Tag muted>{soldOutLabel}</Tag>}
      </div>

      {allergens.length > 0 && (
        <section className="mt-5" aria-label={allergensTitle}>
          <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-charcoal-600/70">
            {allergensTitle}
          </h2>
          <p className="mt-1 text-sm text-ink/60">{allergensContains}</p>
          <ul className="mt-2.5 flex flex-wrap gap-2">
            {allergens.map((label) => (
              <li
                key={label}
                className="rounded-full border border-ember-600/25 bg-ember-600/8 px-3 py-1 text-xs font-semibold text-ember-700"
              >
                {label}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Tag({
  children,
  muted,
}: {
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
        muted
          ? "bg-charcoal-600/10 text-charcoal-500"
          : "bg-cream-100 text-charcoal-600/85"
      }`}
    >
      {children}
    </span>
  );
}
