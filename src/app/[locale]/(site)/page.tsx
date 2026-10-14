import { Fragment, type ReactNode } from "react";
import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { getHomeLayout, getSiteMedia } from "@/lib/content/site";
import Motion from "@/components/motion/Motion";
import Hero from "@/components/home/Hero";
import Marquee from "@/components/home/Marquee";
import Story from "@/components/home/Story";
import Categories from "@/components/home/Categories";
import Showcase from "@/components/home/Showcase";
import Testimonials from "@/components/home/Testimonials";
import Faq from "@/components/home/Faq";
import Popular from "@/components/home/Popular";
import Why from "@/components/home/Why";
import DeliveryArea from "@/components/home/DeliveryArea";
import FinalCta from "@/components/home/FinalCta";
import FeedbackCta from "@/components/feedback/FeedbackCta";
import { getPublicSettings } from "@/lib/admin/store";
import { pageMetadata } from "@/lib/seo";
import HomeSchema from "@/components/schema/HomeSchema";
import { getStoreStatus } from "@/lib/store-status";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "seo" });
  return pageMetadata({
    locale,
    path: "",
    title: `${t("homeTitle")} | Kebabish`,
    absoluteTitle: true,
    description: t("homeDescription"),
  });
}

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale });
  const marqueeItems = t.raw("home.marquee") as string[];
  const settings = await getPublicSettings();
  const { isOpen } = getStoreStatus(settings);
  // The owner's choice of which sections show, and in what order
  // (/admin/content/homepage). The default is the order below.
  const [layout, media] = await Promise.all([getHomeLayout(), getSiteMedia()]);

  // Showcase and Testimonials each render nothing until there is real content
  // behind them (photos picked in /admin, reviews added there), so the page
  // reads correctly either way.
  const sections: Record<string, ReactNode> = {
    hero: (
      <Hero
        locale={locale}
        media={{ web: media.heroWeb, mobile: media.heroMobile }}
        showBadge={settings.showLaunchBadge ?? true}
      />
    ),
    marquee: <Marquee items={marqueeItems} />,
    story: <Story locale={locale} />,
    categories: <Categories locale={locale} />,
    popular: <Popular locale={locale} isOpen={isOpen} />,
    why: <Why locale={locale} />,
    showcase: <Showcase locale={locale} />,
    testimonials: <Testimonials locale={locale} />,
    delivery: <DeliveryArea locale={locale} />,
    faq: <Faq locale={locale} />,
    cta: <FinalCta locale={locale} isOpen={isOpen} />,
    feedback: <FeedbackCta locale={locale} />,
  };

  return (
    <>
      {/* Every section below is a server component; Motion is the single
          client island that drives the GSAP timelines and smooth scrolling. */}
      <Motion />
      <HomeSchema locale={locale} />

      {layout
        .filter((entry) => entry.enabled)
        .map((entry) => (
          <Fragment key={entry.id}>{sections[entry.id]}</Fragment>
        ))}
    </>
  );
}
