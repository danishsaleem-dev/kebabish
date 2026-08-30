"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Menu, X, MessageCircle } from "lucide-react";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";

export default function Header() {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/menu", label: t("menu") },
    { href: "/contact", label: t("contact") },
  ];

  const whatsappHref = whatsappOrderLink(
    locale === "nl"
      ? "Hallo Kebabish! Ik wil graag een bestelling plaatsen."
      : "Hi Kebabish! I'd like to place an order."
  );

  return (
    <header className="sticky top-0 z-50 border-b border-cream-dark bg-cream/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="font-display text-2xl font-semibold text-maroon">
          {siteConfig.brandName}
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`text-sm font-medium transition-colors hover:text-terracotta ${
                pathname === link.href ? "text-terracotta" : "text-charcoal"
              }`}
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LocaleSwitch locale={locale} />
          <a
            href={whatsappHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 text-sm font-semibold text-cream transition-colors hover:bg-terracotta-dark"
          >
            <MessageCircle size={18} />
            {tCommon("orderNow")}
          </a>
        </div>

        <button
          type="button"
          aria-label="Menu"
          className="flex h-11 w-11 items-center justify-center rounded-full text-charcoal md:hidden"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {open && (
        <div className="border-t border-cream-dark bg-cream px-4 pb-6 md:hidden">
          <nav className="flex flex-col gap-1 pt-2">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-3 text-base font-medium text-charcoal hover:bg-cream-dark"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-3 flex items-center justify-between gap-3">
            <LocaleSwitch locale={locale} />
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-terracotta px-5 py-3 text-sm font-semibold text-cream"
            >
              <MessageCircle size={18} />
              {tCommon("orderNow")}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}

function LocaleSwitch({ locale }: { locale: string }) {
  const pathname = usePathname();
  return (
    <div className="flex items-center overflow-hidden rounded-full border border-cream-dark text-xs font-semibold">
      {routing.locales.map((loc) => (
        <Link
          key={loc}
          href={pathname}
          locale={loc}
          className={`px-3 py-2 uppercase transition-colors ${
            locale === loc ? "bg-maroon text-cream" : "text-charcoal hover:bg-cream-dark"
          }`}
        >
          {loc}
        </Link>
      ))}
    </div>
  );
}
