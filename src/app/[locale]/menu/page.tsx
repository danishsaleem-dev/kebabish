import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { menu } from "@/lib/menu-data";
import MenuItemCardServer from "@/components/MenuItemCard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "menu" });
  return {
    title: t("title"),
    description: t("intro"),
  };
}

export default async function MenuPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "menu" });

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold text-maroon">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-charcoal/75">{t("intro")}</p>
      </div>

      <div className="mt-14 space-y-16">
        {menu.map((category) => (
          <section key={category.id} id={category.id}>
            <h2 className="font-display text-2xl font-semibold text-maroon">
              {t(`categories.${category.id}`)}
            </h2>
            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {category.items.map((item) => (
                <MenuItemCardServer key={item.slug} item={item} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
