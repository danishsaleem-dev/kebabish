"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Instagram, Facebook, Music2 } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

const SOCIALS = [
  { href: siteConfig.socials.instagram, label: "Instagram", Icon: Instagram },
  { href: siteConfig.socials.facebook, label: "Facebook", Icon: Facebook },
  { href: siteConfig.socials.tiktok, label: "TikTok", Icon: Music2 },
];

export default function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const year = new Date().getFullYear();

  const navLinks = [
    { href: "/", label: tNav("home") },
    { href: "/menu", label: tNav("menu") },
    { href: "/contact", label: tNav("contact") },
  ];

  return (
    <footer className="relative overflow-hidden bg-charcoal-950 text-cream-100">
      <div className="grain absolute inset-0" />

      <div className="relative z-10 mx-auto grid max-w-6xl gap-12 px-5 py-16 sm:px-6 sm:py-20 md:grid-cols-4">
        <div className="md:col-span-1">
          <Image
            src="/logo/kebabish-dark.png"
            alt={siteConfig.brandName}
            width={440}
            height={330}
            className="h-20 w-auto"
          />
          <p className="mt-5 text-sm text-cream-200/65">{t("tagline")}</p>
          <p className="mt-5 inline-flex items-center gap-2 rounded-full border border-ember-500/30 bg-ember-600/12 px-3.5 py-1.5 text-xs font-semibold text-ember-400">
            <span className="h-1.5 w-1.5 rounded-full bg-ember-500" />
            {t("deliveryOnly")}
          </p>
        </div>

        <FooterColumn title={t("quickLinks")}>
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href} className="link-underline">
                {link.label}
              </Link>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title={t("contact")}>
          <li className="text-cream-200/70">{siteConfig.address.street}</li>
          <li className="text-cream-200/70">
            {siteConfig.address.postalCode} {siteConfig.address.city}
          </li>
          <li>
            <a href={`tel:${siteConfig.contact.phone}`} className="link-underline">
              {siteConfig.contact.phone}
            </a>
          </li>
          <li>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="link-underline"
            >
              {siteConfig.contact.email}
            </a>
          </li>
        </FooterColumn>

        <div>
          <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-400">
            {t("followUs")}
          </p>
          <div className="mt-4 flex gap-2.5">
            {SOCIALS.map(({ href, label, Icon }) => (
              <a
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={label}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-cream-200/15 text-cream-200/75 transition-colors duration-300 hover:border-ember-500/50 hover:bg-ember-600 hover:text-cream-50"
              >
                <Icon size={17} />
              </a>
            ))}
          </div>
          <p className="mt-4 text-sm text-cream-200/55">
            {siteConfig.socials.handle}
          </p>
        </div>
      </div>

      <div className="relative z-10 border-t border-cream-200/10 px-5 py-6 text-center text-xs leading-relaxed text-cream-200/50 sm:px-6">
        © {year} {siteConfig.brandName}. {t("rights")}
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="font-display text-xs font-semibold uppercase tracking-[0.2em] text-ember-400">
        {title}
      </p>
      <ul className="mt-4 space-y-2.5 text-sm text-cream-200/80">{children}</ul>
    </div>
  );
}
