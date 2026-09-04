import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Bitter, Inter } from "next/font/google";
import { hasLocale } from "next-intl";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { siteConfig } from "@/lib/site-config";
import StructuredData from "@/components/StructuredData";
import "../globals.css";

// Inter for body copy, Bitter (slab serif) for headings — picked to sit
// beside the logo's hand-cut serif wordmark. See globals.css.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const bitter = Bitter({
  subsets: ["latin"],
  variable: "--font-bitter",
  display: "swap",
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "hero" });

  return {
    metadataBase: new URL(siteConfig.website),
    title: {
      default: `${siteConfig.brandName} Hoogkarspel — ${t("subtitle")}`,
      template: `%s | ${siteConfig.brandName}`,
    },
    description: t("description"),
    alternates: {
      canonical: locale === routing.defaultLocale ? "/" : `/${locale}`,
      languages: {
        nl: "/",
        en: "/en",
      },
    },
    openGraph: {
      title: `${siteConfig.brandName} Hoogkarspel`,
      description: t("description"),
      url: siteConfig.website,
      siteName: siteConfig.brandName,
      locale: locale === "nl" ? "nl_NL" : "en_US",
      type: "website",
    },
    icons: {
      icon: "/favicon.ico",
    },
  };
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await getMessages();

  return (
    <html lang={locale} className={`${inter.variable} ${bitter.variable} js`}>
      <head>
        {/*
          Scroll-reveal elements start hidden under `.js` so they can animate
          in. Without scripting they'd never be revealed, so drop the priming
          entirely for no-JS readers rather than serving them a blank page.
        */}
        <noscript>
          <style>{`[data-reveal],[data-reveal-mask] > * > *{opacity:1!important;transform:none!important}[data-hero-veil]{display:none!important}`}</style>
        </noscript>
      </head>
      <body className="flex min-h-screen flex-col bg-cream-200 font-sans text-ink antialiased">
        <NextIntlClientProvider messages={messages}>
          <StructuredData locale={locale} />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
