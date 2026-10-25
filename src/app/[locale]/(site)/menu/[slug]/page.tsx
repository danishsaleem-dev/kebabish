import type { Metadata } from "next";
import BrandLogo from "@/components/shared/BrandLogo";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import Image from "next/image";
import { ArrowLeft, Bike, Check, ChevronRight, Flame, Leaf, Lock, MapPin, PlayCircle, ShieldAlert } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getPublicItem, getPublicItemSlugs, getRelatedItems } from "@/lib/public-menu";
import { getPublicSettings } from "@/lib/admin/store";
import { getStoreStatus } from "@/lib/store-status";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import { pageMetadata, snippet } from "@/lib/seo";
import ProductSchema from "@/components/schema/ProductSchema";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import { formatEuro } from "@/lib/money";
import ItemOrderPanel from "@/components/menu/ItemOrderPanel";
import ItemGallery from "@/components/menu/ItemGallery";
import FeaturedDishCard from "@/components/home/FeaturedDishCard";
import FeedbackCta from "@/components/feedback/FeedbackCta";
import DishBadges from "@/components/menu/DishBadges";
import SpiceMeter, { Chili } from "@/components/menu/SpiceMeter";
import ExpandableText from "@/components/menu/ExpandableText";
import ShareButton from "@/components/menu/ShareButton";
import PaymentMarks from "@/components/home/PaymentMarks";
import Testimonials from "@/components/home/Testimonials";

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
  const found = await getPublicItem(slug, locale);
  if (!found) return {};

  const { item, category } = found;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: `/menu/${slug}`,
    // Name the category only when it exists in this language — an English
    // title that ends in a Dutch word reads as a mistake.
    title: category.translated
      ? t("dishTitle", { name: item.name, category: category.label })
      : item.name,
    description: dishDescription(item, t),
    image: item.image ? { url: item.image, alt: item.name } : undefined,
  });
}

/**
 * The search snippet for a dish. Prefer what Danish wrote — a real
 * description beats any template — but only in the page's own language: on
 * /en a Dutch snippet (the fallback when no English one exists) reads as a
 * mismatch, so there it falls back to a generic English line. A short written
 * description is topped up with where the dish is delivered, so even a
 * one-liner has the local terms a search is matched on.
 */
function dishDescription(
  item: NonNullable<Awaited<ReturnType<typeof getPublicItem>>>["item"],
  t: Awaited<ReturnType<typeof getTranslations>>,
  { forSnippet = true }: { forSnippet?: boolean } = {}
): string {
  const written = item.descriptionTranslated
    ? item.description.replace(/\s+/g, " ").trim()
    : "";
  if (!written) return t("dishFallback", { name: item.name });
  const full = written.length < 90 ? `${written} ${t("dishTail")}` : written;
  // Only the meta description has a display limit; the structured data does not,
  // and a Product description cut off mid-sentence with "…" reads as a mistake.
  return forSnippet ? snippet(full) : full;
}

export default async function ItemPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const found = await getPublicItem(slug, locale);
  if (!found) notFound();

  const { item, category } = found;
  const t = await getTranslations({ locale });
  const [settings, related] = await Promise.all([
    getPublicSettings(),
    getRelatedItems(slug, locale),
  ]);
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

  const tSeo = await getTranslations({ locale, namespace: "seo" });
  const schemaDescription = dishDescription(item, tSeo, { forSnippet: false });

  // What delivery costs, straight from Settings — the same rules checkout applies.
  const deliveryFacts = [
    settings.deliveryFee > 0
      ? t("item.deliveryFee", { fee: formatEuro(settings.deliveryFee) })
      : t("item.deliveryFree"),
    settings.deliveryFee > 0 && settings.freeDeliveryOver != null
      ? t("item.freeOver", { amount: formatEuro(settings.freeDeliveryOver) })
      : null,
    settings.minimumOrder > 0 ? t("item.minimumOrder", { amount: formatEuro(settings.minimumOrder) }) : null,
  ].filter((f): f is string => Boolean(f));

  return (
    <>
      <div className="relative isolate">
        {/* A warm glow behind the top of the page, so the photo sits in light. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[38rem] bg-[radial-gradient(60%_60%_at_20%_0%,rgba(169,80,38,0.14),transparent_70%)]"
        />

        <div className="mx-auto max-w-6xl px-5 pb-4 pt-6 sm:px-6 sm:pt-10">
          <ProductSchema
            locale={locale}
            item={item}
            category={category.label}
            description={schemaDescription}
          />
          <BreadcrumbSchema
            locale={locale}
            items={[
              { name: t("nav.menu"), path: "/menu" },
              { name: item.name, path: `/menu/${slug}` },
            ]}
          />

          {/* ---- breadcrumb + share ------------------------------------- */}
          <div className="flex items-center justify-between gap-4">
            <nav aria-label={t("item.breadcrumb")} className="min-w-0">
              <ol className="flex min-w-0 items-center gap-1.5 text-sm text-ink/55">
                <li className="shrink-0">
                  <Link href="/menu" className="inline-flex items-center gap-1.5 font-medium transition-colors hover:text-charcoal-600">
                    <ArrowLeft size={15} aria-hidden="true" className="sm:hidden" />
                    {t("nav.menu")}
                  </Link>
                </li>
                <li aria-hidden="true" className="hidden shrink-0 sm:block">
                  <ChevronRight size={14} />
                </li>
                <li className="hidden min-w-0 sm:block">
                  <Link href={`/menu#${category.id}`} className="block truncate transition-colors hover:text-charcoal-600">
                    {category.label}
                  </Link>
                </li>
                <li aria-hidden="true" className="hidden shrink-0 sm:block">
                  <ChevronRight size={14} />
                </li>
                <li aria-current="page" className="hidden min-w-0 truncate font-semibold text-charcoal-600 sm:block">
                  {item.name}
                </li>
              </ol>
            </nav>
            <ShareButton title={item.name} label={t("item.share")} copiedLabel={t("item.shareCopied")} />
          </div>

          <div className="mt-6 grid items-start gap-8 lg:mt-8 lg:grid-cols-2 lg:gap-12">
            {/* ---- photos (stick while the buy box scrolls) ------------- */}
            <div className="min-w-0 lg:sticky lg:top-24">
              {item.images.length > 0 ? (
                <ItemGallery
                  images={item.images}
                  alt={item.name}
                  photoLabels={item.images.map((_, i) =>
                    t("item.photoCounter", { current: i + 1, total: item.images.length })
                  )}
                  zoomLabel={t("item.zoomPhoto")}
                  closeLabel={t("item.closePhoto")}
                  previousLabel={t("item.previousPhoto")}
                  nextLabel={t("item.nextPhoto")}
                  overlay={<DishBadges chefsPick={item.chefsPick} bestseller={item.bestseller} />}
                />
              ) : (
                <div className="relative aspect-4/3 overflow-hidden rounded-[2rem] bg-cream-300 ring-1 ring-charcoal-600/8">
                  <div className="flex h-full w-full items-center justify-center bg-[radial-gradient(80%_70%_at_50%_30%,var(--color-cream-200),var(--color-cream-400))]">
                    <BrandLogo
                      src="/logo/Kebabish-light.png"
                      alt=""
                      width={260}
                      height={195}
                      className="h-auto w-28 opacity-25"
                    />
                  </div>
                </div>
              )}
              <GoodToKnow t={t} className="mt-5 hidden lg:grid" />
            </div>

            {/* ---- the buy box ------------------------------------------ */}
            <div className="min-w-0 rounded-[2rem] bg-cream-50 p-5 shadow-[0_1px_2px_rgba(20,18,15,0.04),0_24px_60px_-30px_rgba(20,18,15,0.25)] ring-1 ring-charcoal-600/8 sm:p-8">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/menu#${category.id}`}
                  className="rounded-full bg-ember-600/10 px-3 py-1 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ember-700 transition-colors hover:bg-ember-600/15"
                >
                  {category.label}
                </Link>
                {item.images.length === 0 && (
                  <DishBadges chefsPick={item.chefsPick} bestseller={item.bestseller} />
                )}
              </div>

              <h1 className="mt-4 text-balance font-display text-3xl font-semibold leading-[1.1] text-charcoal-600 sm:text-[2.6rem]">
                {item.name}
              </h1>

              <div className="mt-4 flex flex-wrap items-end gap-x-3 gap-y-1">
                <span className="font-display text-3xl font-bold tabular-nums text-charcoal-700">
                  {item.price != null ? formatEuro(item.price) : t("menu.priceOnRequest")}
                </span>
                {item.portion && <span className="pb-1 text-sm text-ink/55">{item.portion}</span>}
                {item.variants.length > 0 && (
                  <span className="pb-1 text-sm text-ink/55">· {item.variants.join(" · ")}</span>
                )}
              </div>

              {/* Facts at a glance. */}
              <ul className="mt-5 flex flex-wrap gap-2">
                {item.spiceLevel !== 0 && (
                  <Chip>
                    <SpiceMeter level={item.spiceLevel} size="sm" />
                  </Chip>
                )}
                {item.vegetarian && (
                  <Chip>
                    <Leaf size={14} aria-hidden="true" className="text-green-700" />
                    {t("menu.vegetarian")}
                  </Chip>
                )}
                <Chip>
                  <Image src="/halal.png" alt="" width={18} height={18} sizes="18px" className="h-[18px] w-[18px]" />
                  {t("common.halalBadge")}
                </Chip>
                <Chip>
                  <Flame size={14} aria-hidden="true" className="text-ember-600" />
                  {t("item.freshChip")}
                </Chip>
                {item.soldOut && <Chip muted>{t("menu.soldOut")}</Chip>}
              </ul>

              {item.description && (
                <ExpandableText
                  text={item.description}
                  more={t("item.readMore")}
                  less={t("item.readLess")}
                  className="mt-5"
                />
              )}

              {allergenLabels.length > 0 && (
                <a
                  href="#allergenen"
                  className="mt-5 flex items-center gap-2 rounded-2xl bg-cream-100 px-4 py-3 text-sm text-ink/70 transition-colors hover:bg-cream-200"
                >
                  <ShieldAlert size={16} aria-hidden="true" className="shrink-0 text-ember-600" />
                  <span className="min-w-0 truncate">
                    <span className="font-semibold text-charcoal-600">{t("item.allergensContains")}</span>{" "}
                    {allergenLabels.join(", ")}
                  </span>
                  <ChevronRight size={15} aria-hidden="true" className="ml-auto shrink-0 text-ink/40" />
                </a>
              )}

              <div className="my-7 h-px bg-charcoal-600/8" />

              <ItemOrderPanel item={item} isOpen={isOpen} whatsappHref={whatsappHref} />

              {/* ---- delivery + payment -------------------------------- */}
              <div className="mt-7 rounded-2xl border border-charcoal-600/8 bg-cream-100/70 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold text-charcoal-600">
                  <Bike size={16} aria-hidden="true" className="text-ember-600" />
                  {t("item.deliveryTitle")}
                </p>
                <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink/65">
                  {deliveryFacts.map((fact) => (
                    <li key={fact} className="flex items-center gap-1.5">
                      <Check size={13} aria-hidden="true" className="text-success" />
                      {fact}
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink/50">{t("item.slotNote")}</p>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-charcoal-600/8 pt-3">
                  <Lock size={13} aria-hidden="true" className="text-charcoal-600/60" />
                  <span className="text-xs font-semibold text-charcoal-600/70">{t("home.paySecure")}</span>
                  <PaymentMarks cardLabel={t("home.payCard")} size="sm" />
                </div>
              </div>
            </div>
          </div>

          {/* ---- more about the dish ------------------------------------ */}
          <section className="mt-16 sm:mt-20" aria-labelledby="dish-details">
            <h2 id="dish-details" className="font-display text-2xl font-semibold text-charcoal-600 sm:text-3xl">
              {t("item.aboutTitle")}
            </h2>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {/* Allergens. */}
              <article id="allergenen" className="scroll-mt-28 rounded-3xl bg-cream-50 p-6 ring-1 ring-charcoal-600/8">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600">
                  <ShieldAlert size={20} aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-charcoal-600">{t("item.allergens")}</h3>
                {allergenLabels.length > 0 ? (
                  <>
                    <p className="mt-1 text-sm text-ink/60">{t("item.allergensContains")}</p>
                    <ul className="mt-3 flex flex-wrap gap-2">
                      {allergenLabels.map((label) => (
                        <li
                          key={label}
                          className="rounded-full border border-ember-600/25 bg-ember-600/8 px-3 py-1 text-xs font-semibold text-ember-700"
                        >
                          {label}
                        </li>
                      ))}
                    </ul>
                    <p className="mt-4 text-xs leading-relaxed text-ink/55">{t("item.allergensNote")}</p>
                  </>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-ink/60">{t("item.allergensNone")}</p>
                )}
                <Link
                  href="/contact"
                  className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-ember-600 hover:text-ember-700"
                >
                  {t("item.contactUs")}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </article>

              {/* How hot. */}
              <article className="rounded-3xl bg-charcoal-800 p-6 text-cream-100">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-ember-600/20 text-ember-400">
                  <Chili className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-display text-lg font-semibold text-cream-50">{t("menu.spiceScale")}</h3>
                <p className="mt-1 text-sm text-cream-200/65">
                  {item.spiceLevel === null
                    ? t("item.spiceUnknown")
                    : item.spiceLevel === 0
                      ? t("item.spiceNone")
                      : t("item.spiceThis")}
                </p>
                <ol className="mt-4 space-y-2">
                  {[1, 2, 3].map((level) => {
                    const here = item.spiceLevel === level;
                    return (
                      <li
                        key={level}
                        aria-current={here ? "true" : undefined}
                        className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${
                          here ? "bg-ember-600 text-cream-50" : "bg-cream-50/[0.05] text-cream-100/70"
                        }`}
                      >
                        <span className={`inline-flex -space-x-1 ${here ? "text-cream-50" : "text-ember-400"}`}>
                          {[1, 2, 3].map((n) => (
                            <Chili key={n} className="h-4 w-4" lit={n <= level} />
                          ))}
                        </span>
                        <span className="text-sm font-semibold">
                          {level === 1 ? t("menu.spiceMild") : level === 2 ? t("menu.spiceMedium") : t("menu.spiceHot")}
                        </span>
                        {here && <Check size={15} aria-hidden="true" className="ml-auto" />}
                      </li>
                    );
                  })}
                </ol>
              </article>

              <GoodToKnow t={t} className="md:col-span-2 lg:hidden" />
            </div>

            {item.videoUrl && (
              <div className="mt-4 overflow-hidden rounded-[2rem] bg-charcoal-900 ring-1 ring-charcoal-600/10">
                <div className="flex items-center gap-2 px-6 pt-5 text-cream-100">
                  <PlayCircle size={18} aria-hidden="true" className="text-ember-400" />
                  <h3 className="font-display text-lg font-semibold">{t("item.videoTitle")}</h3>
                </div>
                {/* preload="metadata" + #t=0.001 shows the first frame without
                    pulling the whole file, and nothing plays until the customer
                    asks — this page is an SEO/PageSpeed landing page first. */}
                <video
                  src={`${item.videoUrl}#t=0.001`}
                  controls
                  playsInline
                  preload="metadata"
                  aria-label={t("item.videoLabel", { item: item.name })}
                  className="mt-4 aspect-video w-full bg-charcoal-950 object-cover"
                />
              </div>
            )}
          </section>

        </div>

        {/* What customers say — renders nothing until there are reviews. Full width,
            so it sits between the dish details and the related dishes. */}
        <div className="mt-16 sm:mt-20">
          <Testimonials locale={locale} compact />
        </div>

        <div className="mx-auto max-w-6xl px-5 sm:px-6">
          {related.length > 0 && (
            <section className="mt-16 sm:mt-20">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="font-display text-2xl font-semibold text-charcoal-600 sm:text-3xl">
                  {t("item.relatedTitle")}
                </h2>
                <Link
                  href="/menu"
                  className="link-underline inline-flex items-center gap-1.5 font-display text-sm font-semibold text-ember-600"
                >
                  {t("item.relatedAll")}
                  <ChevronRight size={15} aria-hidden="true" />
                </Link>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {related.map((dish) => (
                  <FeaturedDishCard
                    key={dish.slug}
                    item={dish}
                    addLabel={t("menu.addToOrder")}
                    priceOnRequestLabel={t("menu.priceOnRequest")}
                    vegetarianLabel={t("menu.vegetarian")}
                    soldOutLabel={t("menu.soldOut")}
                    lowStockLabel={t("menu.lowStock")}
                    isOpen={isOpen}
                    unavailableLabel={t("status.menuUnavailable")}
                    reveal={false}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
      <FeedbackCta locale={locale} />
    </>
  );
}

/** Fresh, halal, delivered — beside the photo on a laptop, in the details grid on a phone. */
/**
 * Fresh, halal, delivered — three short facts, each an icon, a title and a few words.
 * Beside the photo on a laptop, in the details grid on a phone. Kept deliberately
 * brief (Danish's call): the dish is the subject of this page, not our selling points.
 */
function GoodToKnow({
  t,
  className = "",
}: {
  t: Awaited<ReturnType<typeof getTranslations>>;
  className?: string;
}) {
  const facts = [
    { icon: <Flame size={17} aria-hidden="true" />, title: t("item.freshTitle"), text: t("item.freshShort") },
    {
      icon: <Image src="/halal.png" alt="" width={20} height={20} sizes="20px" className="h-5 w-5" />,
      title: t("home.why5Title"),
      text: t("item.halalShort"),
    },
    {
      icon: <MapPin size={17} aria-hidden="true" />,
      title: t("item.deliveredShortTitle", { km: siteConfig.deliveryRadiusKm }),
      text: t("item.deliveredShort"),
    },
  ];
  return (
    <ul
      aria-label={t("item.goodToKnow")}
      className={`grid grid-cols-3 divide-x divide-charcoal-600/8 rounded-3xl bg-cream-50 py-4 ring-1 ring-charcoal-600/8 ${className}`}
    >
      {facts.map((fact) => (
        <li key={fact.title} className="flex flex-col items-center gap-1.5 px-2 text-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-200 text-ember-600">
            {fact.icon}
          </span>
          <span className="text-[0.8rem] font-semibold leading-tight text-charcoal-600 sm:text-sm">{fact.title}</span>
          <span className="text-[0.7rem] leading-tight text-ink/55 sm:text-xs">{fact.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Chip({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <li
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${
        muted ? "bg-charcoal-600/10 text-charcoal-500" : "bg-cream-100 text-charcoal-600/85 ring-1 ring-charcoal-600/8"
      }`}
    >
      {children}
    </li>
  );
}
