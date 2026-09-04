import { Building2, ExternalLink } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SettingsForm from "@/components/admin/SettingsForm";
import { getSettings } from "@/lib/admin/store";
import { siteConfig } from "@/lib/site-config";

export const metadata = { title: "Settings" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await getSettings();

  const businessFacts = [
    { label: "Trading name", value: siteConfig.brandName },
    { label: "Legal entity", value: siteConfig.companyName },
    { label: "KVK number", value: siteConfig.kvkNumber },
    {
      label: "Address",
      value: `${siteConfig.address.street}, ${siteConfig.address.postalCode} ${siteConfig.address.city}`,
    },
    { label: "Phone / WhatsApp", value: siteConfig.contact.phone },
    { label: "Email", value: siteConfig.contact.email },
    { label: "Website", value: siteConfig.website },
  ];

  return (
    <AdminShell title="Settings">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <SettingsForm settings={settings} />

        <Card>
          <div className="flex items-start gap-3">
            <Building2 size={18} className="mt-0.5 shrink-0 text-ember-600" />
            <div className="min-w-0 flex-1">
              <CardHeader
                title="Business details"
                subtitle="These live in code as the single source of truth for the public site, its metadata and its structured data."
              />

              <dl className="mt-4 divide-y divide-hairline">
                {businessFacts.map((fact) => (
                  <div
                    key={fact.label}
                    className="flex flex-wrap justify-between gap-2 py-2.5 text-sm"
                  >
                    <dt className="text-muted">{fact.label}</dt>
                    <dd className="font-medium text-heading">{fact.value}</dd>
                  </div>
                ))}
              </dl>

              <p className="mt-4 rounded-xl bg-canvas p-3 text-xs leading-relaxed text-muted">
                Changing any of these means editing{" "}
                <code className="rounded bg-hairline px-1">
                  src/lib/site-config.ts
                </code>
                . They&apos;re deliberately not editable here — they feed the
                site&apos;s SEO metadata and legal footer, so a typo would
                propagate everywhere. Ask me to change one and I&apos;ll do it
                in a single place.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Not wired up yet"
            subtitle="These need accounts and API keys before there's anything to configure."
          />
          <ul className="mt-4 divide-y divide-hairline text-sm">
            {[
              {
                name: "Supabase",
                detail: "Database, admin login and image storage",
              },
              { name: "Mollie", detail: "iDEAL, cards, Apple & Google Pay" },
              {
                name: "Google Maps",
                detail: "Delivery-radius check on checkout",
              },
            ].map((service) => (
              <li
                key={service.name}
                className="flex flex-wrap items-center justify-between gap-2 py-3"
              >
                <div>
                  <p className="font-medium text-heading">{service.name}</p>
                  <p className="text-xs text-muted">{service.detail}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-hairline px-2.5 py-1 text-xs font-semibold text-muted">
                  <ExternalLink size={12} />
                  Needs keys
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}
