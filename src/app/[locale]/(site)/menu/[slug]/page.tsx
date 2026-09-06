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
  const { slug } = await params;
  const found = await getPublicItem(slug);
  if (!found) return {};

  const { item } = found;
  return {
    title: item.name,
    description: `${item.name} — ${siteConfig.brandName}, ${siteConfig.address.city}.`,
    openGraph: item.image ? { images: [item.image] } : undefined,
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

  return (
    <div className="mx-auto max-w-5xl px-5 py-10 sm:px-6 sm:py-14">
      <Link
        href="/menu"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink/60 transition-colors hover:text-charcoal-600"
      >
        <ArrowLeft size={16} />
        {t("item.backToMenu")}
      </Link>

      <div className="mt-8 grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div>
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

          <div className="mt-6 lg:hidden">
            <ItemHeading
              item={item}
              category={category.label}
              vegetarianLabel={t("menu.vegetarian")}
              spicyLabel={t("menu.spicy")}
              priceOnRequestLabel={t("menu.priceOnRequest")}
              soldOutLabel={t("menu.soldOut")}
            />
          </div>
        </div>

        <div>
          <div className="hidden lg:block">
            <ItemHeading
              item={item}
              category={category.label}
              vegetarianLabel={t("menu.vegetarian")}
              spicyLabel={t("menu.spicy")}
              priceOnRequestLabel={t("menu.priceOnRequest")}
              soldOutLabel={t("menu.soldOut")}
            />
          </div>

          <div className="mt-8">
            <ItemOrderPanel
              item={item}
              isOpen={isOpen}
              whatsappHref={whatsappHref}
            />
          </div>
        </div>
      </div>
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
}: {
  item: Awaited<ReturnType<typeof getPublicItem>> extends null
    ? never
    : NonNullable<Awaited<ReturnType<typeof getPublicItem>>>["item"];
  category: string;
  vegetarianLabel: string;
  spicyLabel: string;
  priceOnRequestLabel: string;
  soldOutLabel: string;
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
