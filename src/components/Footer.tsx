"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Instagram, Facebook, Music2 } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export default function Footer() {
  const t = useTranslations("footer");
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const year = new Date().getFullYear();

  return (
    <footer className="bg-neutral-900 text-neutral-50">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div>
          <p className="text-xl font-semibold">{siteConfig.brandName}</p>
          <p className="mt-2 text-sm text-neutral-50/80">{t("tagline")}</p>
          <p className="mt-4 inline-block rounded-full bg-neutral-50/10 px-3 py-1 text-xs font-medium">
            {t("deliveryOnly")}
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            {t("quickLinks")}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-50/85">
            <li><Link href="/" className="hover:text-neutral-400">{tNav("home")}</Link></li>
            <li><Link href="/menu" className="hover:text-neutral-400">{tNav("menu")}</Link></li>
            <li><Link href="/contact" className="hover:text-neutral-400">{tNav("contact")}</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            {t("contact")}
          </p>
          <ul className="mt-3 space-y-2 text-sm text-neutral-50/85">
            <li>{siteConfig.address.street}</li>
            <li>{siteConfig.address.postalCode} {siteConfig.address.city}</li>
            <li>
              <a href={`tel:${siteConfig.contact.phone}`} className="hover:text-neutral-400">
                {siteConfig.contact.phone}
              </a>
            </li>
            <li>
              <a href={`mailto:${siteConfig.contact.email}`} className="hover:text-neutral-400">
                {siteConfig.contact.email}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
            {t("followUs")}
          </p>
          <div className="mt-3 flex gap-3">
            <a href={siteConfig.socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className="rounded-full bg-neutral-50/10 p-2 hover:bg-neutral-50/20">
              <Instagram size={18} />
            </a>
            <a href={siteConfig.socials.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className="rounded-full bg-neutral-50/10 p-2 hover:bg-neutral-50/20">
              <Facebook size={18} />
            </a>
            <a href={siteConfig.socials.tiktok} target="_blank" rel="noopener noreferrer" aria-label="TikTok" className="rounded-full bg-neutral-50/10 p-2 hover:bg-neutral-50/20">
              <Music2 size={18} />
            </a>
          </div>
          <p className="mt-4 text-xs text-neutral-50/70">{siteConfig.socials.handle}</p>
        </div>
      </div>

      <div className="border-t border-neutral-50/15 px-4 py-5 text-center text-xs text-neutral-50/70 sm:px-6">
        © {year} {siteConfig.companyName} ({siteConfig.brandName}) — {t("kvk")} {siteConfig.kvkNumber}. {t("rights")}
      </div>
    </footer>
  );
}
