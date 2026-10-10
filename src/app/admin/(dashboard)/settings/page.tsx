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

  // Read from the environment so this can't go stale the way a hard-coded
  // "Not built" label did.
  const mollieLive = (process.env.MOLLIE_API_KEY ?? "").startsWith("live_");
  const integrations = [
    {
      name: "Supabase",
      detail:
        "Database for menu, settings, orders and customers, plus image and video storage, and staff/customer login.",
      status: "Live",
    },
    {
      name: "Mollie",
      detail: mollieLive
        ? "Live payments are on."
        : "Checkout and payments work, but on the TEST key — no real money moves. Swap MOLLIE_API_KEY for the live_ key to go live.",
      status: mollieLive ? "Live" : "Test mode",
    },
    {
      name: "Resend",
      detail: process.env.RESEND_API_KEY
        ? "Sends the new-order alert email to the kitchen."
        : "No API key set — new-order emails are not being sent.",
      status: process.env.RESEND_API_KEY ? "Live" : "Not configured",
    },
    {
      name: "Google Maps",
      detail:
        "Draws the delivery-area map (Static Maps). Address lookup uses the free Dutch PDOK service instead, and the delivery check is by town name.",
      status: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ? "Map only" : "No key",
    },
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
            title="Third-party integrations"
            subtitle="Where each one actually stands — a key being on file isn't the same as the feature being built."
          />
          <ul className="mt-4 divide-y divide-hairline text-sm">
            {integrations.map((service) => (
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
                  {service.status}
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </AdminShell>
  );
}
