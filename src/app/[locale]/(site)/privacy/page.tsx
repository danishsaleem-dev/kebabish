import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import LegalPage from "@/components/legal/LegalPage";
import { pageMetadata } from "@/lib/seo";
import BreadcrumbSchema from "@/components/BreadcrumbSchema";
import FeedbackCta from "@/components/feedback/FeedbackCta";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "privacy" });
  const tSeo = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "/privacy",
    title: t("title"),
    description: tSeo("privacyDescription"),
  });
}

export default async function PrivacyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "privacy" });

  return (
    <>
      <BreadcrumbSchema locale={locale} items={[{ name: t("title"), path: "/privacy" }]} />
      <LegalPage
        title={t("title")}
        updated={t("updated")}
        intro={t("intro")}
        sections={t.raw("sections")}
      />
      <FeedbackCta locale={locale} />
    </>
  );
}
