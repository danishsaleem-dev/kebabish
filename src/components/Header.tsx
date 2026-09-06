"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Menu, X, MessageCircle } from "lucide-react";
import { siteConfig, whatsappOrderLink } from "@/lib/site-config";
import CartButton from "@/components/cart/CartButton";
import BrandLogo from "@/components/shared/BrandLogo";

export default function Header({
  isOpen,
  banner,
}: {
  isOpen: boolean;
  /**
   * Status strip (open/closed, order notice). It renders *inside* this
   * component's positioned container rather than as a sibling: on the
   * homepage the header is `fixed`, so anything rendered after it in the
   * layout slides underneath and collides with the nav row.
   */
  banner?: ReactNode;
}) {
  const t = useTranslations("nav");
  const tCommon = useTranslations("common");
  const tWhatsapp = useTranslations("whatsapp");
  const locale = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // On the homepage the header floats over the dark hero until you scroll
  // past it; everywhere else it's a normal solid sticky bar.
  const isHome = pathname === "/";
  const onHero = isHome && !scrolled && !open;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/menu", label: t("menu") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
  ];

  const whatsappHref = whatsappOrderLink(tWhatsapp("orderGeneric"));

  return (
    <header
      className={`${isHome ? "fixed" : "sticky"} inset-x-0 top-0 z-50 transition-[background-color,box-shadow,border-color] duration-500 ${
        onHero
          ? "border-b border-transparent bg-transparent"
          : "border-b border-charcoal-600/10 bg-cream-200/90 shadow-sm shadow-charcoal-950/5 backdrop-blur-md"
      }`}
    >
      {banner}

      <div
        className={`mx-auto flex max-w-6xl items-center justify-between px-5 transition-[height] duration-500 sm:px-6 ${
          scrolled || !isHome ? "h-16" : "h-20"
        }`}
      >
        <Link
          href="/"
          aria-label={`${siteConfig.brandName} — ${tCommon("deliveryOnly")}`}
          className="shrink-0"
        >
          <BrandLogo
            src={onHero ? "/logo/kebabish-dark.png" : "/logo/Kebabish-light.png"}
            alt={siteConfig.brandName}
            width={440}
            height={330}
            priority
            className={`w-auto transition-[height] duration-500 ${
              scrolled || !isHome ? "h-11" : "h-14"
            }`}
          />
        </Link>

        <nav className="hidden items-center gap-9 md:flex">
          {navLinks.map((link) => {
            const active = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative font-display text-sm font-semibold transition-colors duration-300 ${
                  onHero
                    ? "text-cream-100/85 hover:text-cream-50"
                    : "text-charcoal-600/75 hover:text-charcoal-600"
                }`}
              >
                {link.label}
                <span
                  aria-hidden="true"
                  className={`absolute -bottom-1.5 left-0 h-0.5 w-full origin-left bg-ember-500 transition-transform duration-300 ${
                    active ? "scale-x-100" : "scale-x-0"
                  }`}
                />
              </Link>
            );
          })}
        </nav>

        <div className="hidden items-center gap-3 md:flex">
          <LocaleSwitch locale={locale} onHero={onHero} />
          <CartButton onHero={onHero} />
          {isOpen ? (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full bg-ember-600 px-5 py-2.5 font-display text-sm font-semibold text-cream-50 transition-[background-color,transform] duration-300 hover:-translate-y-0.5 hover:bg-ember-500"
            >
              <MessageCircle size={17} />
              {tCommon("orderNow")}
            </a>
          ) : (
            <span
              className={`inline-flex cursor-default items-center gap-2 rounded-full border px-5 py-2.5 font-display text-sm font-semibold ${
                onHero
                  ? "border-cream-100/30 text-cream-100/70"
                  : "border-charcoal-600/20 text-charcoal-600/50"
              }`}
            >
              <MessageCircle size={17} />
              {tCommon("closedNow")}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 md:hidden">
          <LocaleSwitch locale={locale} onHero={onHero} />
          <CartButton onHero={onHero} />
          <button
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            className={`-mr-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 ${
              onHero ? "text-cream-100" : "text-charcoal-600"
            }`}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={26} /> : <Menu size={26} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-charcoal-600/10 bg-cream-200 px-5 pb-6 md:hidden">
          <nav className="flex flex-col gap-1 pt-3">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setOpen(false)}
                aria-current={pathname === link.href ? "page" : undefined}
                className={`rounded-xl px-4 py-3.5 font-display text-base font-semibold transition-colors ${
                  pathname === link.href
                    ? "bg-cream-100 text-ember-600"
                    : "text-charcoal-600 hover:bg-cream-100"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-4">
            {isOpen ? (
              <a
                href={whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-full bg-ember-600 px-5 py-3.5 font-display text-sm font-semibold text-cream-50"
              >
                <MessageCircle size={17} />
                {tCommon("orderNow")}
              </a>
            ) : (
              <span className="flex cursor-default items-center justify-center gap-2 rounded-full border border-charcoal-600/20 px-5 py-3.5 font-display text-sm font-semibold text-charcoal-600/50">
                <MessageCircle size={17} />
                {tCommon("closedNow")}
              </span>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

function LocaleSwitch({
  locale,
  onHero,
}: {
  locale: string;
  onHero: boolean;
}) {
  const pathname = usePathname();

  return (
    <div
      className={`flex items-center overflow-hidden rounded-full border text-xs font-semibold transition-colors duration-300 ${
        onHero ? "border-cream-100/30" : "border-charcoal-600/20"
      }`}
    >
      {routing.locales.map((loc) => (
        <Link
          key={loc}
          href={pathname}
          locale={loc}
          aria-label={loc.toUpperCase()}
          className={`px-3 py-2 uppercase transition-colors duration-300 ${
            locale === loc
              ? "bg-ember-600 text-cream-50"
              : onHero
                ? "text-cream-100/75 hover:text-cream-50"
                : "text-charcoal-600/70 hover:text-charcoal-600"
          }`}
        >
          {loc}
        </Link>
      ))}
    </div>
  );
}
