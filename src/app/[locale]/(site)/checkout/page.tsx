import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import CheckoutForm from "@/components/cart/CheckoutForm";
import { getPublicSettings } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";
import { localeAlternates } from "@/lib/seo";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  return {
    title: t("title"),
    robots: { index: false, follow: false },
    alternates: localeAlternates(locale, "/checkout"),
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "checkout" });
  const settings = await getPublicSettings();

  return (
    <div className="mx-auto max-w-5xl px-5 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl font-semibold text-charcoal-600 sm:text-4xl">
        {t("title")}
      </h1>

      <div className="mt-10">
        <CheckoutForm
          deliveryFee={settings.deliveryFee}
          freeDeliveryOver={settings.freeDeliveryOver}
          minimumOrder={settings.minimumOrder}
          deliveryTowns={siteConfig.deliveryAreaTowns.map((t) => t.name)}
        />
      </div>
    </div>
  );
}
