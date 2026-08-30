import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Phone, Mail, MapPin, Clock, Instagram, Facebook, Music2 } from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return { title: t("title"), description: t("intro") };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  const fullAddress = `${siteConfig.address.street}, ${siteConfig.address.postalCode} ${siteConfig.address.city}`;
  const mapSrc = `https://maps.google.com/maps?q=${encodeURIComponent(
    fullAddress
  )}&z=13&output=embed`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="font-display text-4xl font-semibold text-maroon">{t("title")}</h1>
        <p className="mx-auto mt-3 max-w-xl text-base text-charcoal/75">{t("intro")}</p>
      </div>

      <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-2">
        <div className="space-y-8">
          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-maroon">
              <MapPin size={20} /> {t("addressTitle")}
            </h2>
            <p className="mt-2 text-charcoal/85">{fullAddress}</p>
          </div>

          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-maroon">
              <Clock size={20} /> {t("hoursTitle")}
            </h2>
            <p className="mt-2 text-charcoal/85">{t("hoursNote")}</p>
          </div>

          <div>
            <h2 className="flex items-center gap-2 font-display text-lg font-semibold text-maroon">
              <Phone size={20} /> {siteConfig.brandName}
            </h2>
            <a
              href={`tel:${siteConfig.contact.phone}`}
              className="mt-2 block text-charcoal/85 hover:text-terracotta"
            >
              {siteConfig.contact.phone}
            </a>
            <a
              href={`mailto:${siteConfig.contact.email}`}
              className="mt-1 flex items-center gap-2 text-charcoal/85 hover:text-terracotta"
            >
              <Mail size={16} /> {siteConfig.contact.email}
            </a>
          </div>

          <div>
            <h2 className="font-display text-lg font-semibold text-maroon">{t("socialsTitle")}</h2>
            <div className="mt-3 flex gap-3">
              <a href={siteConfig.socials.instagram} target="_blank" rel="noopener noreferrer" className="rounded-full bg-maroon/10 p-2.5 text-maroon hover:bg-maroon hover:text-cream" aria-label="Instagram">
                <Instagram size={18} />
              </a>
              <a href={siteConfig.socials.facebook} target="_blank" rel="noopener noreferrer" className="rounded-full bg-maroon/10 p-2.5 text-maroon hover:bg-maroon hover:text-cream" aria-label="Facebook">
                <Facebook size={18} />
              </a>
              <a href={siteConfig.socials.tiktok} target="_blank" rel="noopener noreferrer" className="rounded-full bg-maroon/10 p-2.5 text-maroon hover:bg-maroon hover:text-cream" aria-label="TikTok">
                <Music2 size={18} />
              </a>
            </div>
          </div>

          <div className="rounded-2xl border border-cream-dark bg-white/60 p-6">
            <h2 className="font-display text-lg font-semibold text-maroon">
              {t("deliveryCheckTitle")}
            </h2>
            <p className="mt-2 text-sm text-charcoal/75">{t("deliveryCheckText")}</p>
            {/* TODO: replace with a live Google Maps Distance Matrix check
                once NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is configured — validate
                the entered postcode is within siteConfig.deliveryRadiusKm
                and show the estimated delivery time. */}
            <p className="mt-3 text-xs italic text-charcoal/50">
              (Postcode-check komt hier zodra de Google Maps koppeling live is.)
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-cream-dark shadow-sm">
          <iframe
            title="Kebabish location"
            src={mapSrc}
            className="h-full min-h-[420px] w-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      </div>
    </div>
  );
}
