import Link from "next/link";
import { ArrowRight, Mail } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SectionTabs from "@/components/admin/marketing/SectionTabs";
import StatGrid, { figure, percent } from "@/components/admin/marketing/StatGrid";
import { StatusChip, when } from "@/components/admin/marketing/format";
import { BrevoProblem, MigrationMissing, NotConnected } from "@/components/admin/marketing/NotSetUp";
import { brevoProblem, isBrevoConfigured } from "@/lib/brevo/client";
import { readAudience, readListState } from "@/lib/brevo/contacts";
import { countSuppressions } from "@/lib/brevo/suppressions";
import { supabaseStore } from "@/lib/brevo/settings";
import {
  hasGoneOut,
  listCampaigns,
  rate,
  statsOf,
  totalStats,
  type Campaign,
} from "@/lib/brevo/campaigns";

export const metadata = { title: "Email marketing" };
export const dynamic = "force-dynamic";

/**
 * The overview.
 *
 * Our own tables supply the audience counts; **every delivery figure comes
 * from Brevo** and nothing is computed from an assumption. If Brevo can't be
 * reached, the campaign half says so and the audience half still works —
 * those are two independent reads and one failing should not blank the page.
 */
export default async function EmailMarketingPage() {
  const configured = isBrevoConfigured();

  const [audience, suppressed, settings] = await Promise.all([
    readAudience(),
    countSuppressions(),
    supabaseStore.read(),
  ]);

  let campaigns: Campaign[] = [];
  let brevoError: string | null = null;
  let listTotal: number | null = null;

  if (configured) {
    try {
      const [list, recent] = await Promise.all([readListState(), listCampaigns(20)]);
      listTotal = list?.totalSubscribers ?? null;
      campaigns = recent;
    } catch (error) {
      brevoError = brevoProblem(error);
    }
  }

  const sent = campaigns.filter(hasGoneOut);
  const totals = totalStats(sent);

  return (
    <AdminShell title="Email marketing">
      <div className="space-y-4 sm:space-y-6">
        <SectionTabs />

        {!audience.schemaReady && <MigrationMissing />}
        {!configured && <NotConnected />}
        {brevoError && <BrevoProblem message={brevoError} />}

        <StatGrid
          stats={[
            {
              label: "Eligible subscribers",
              value:
                audience.suppressed === null
                  ? "—"
                  : audience.contacts.length.toLocaleString("en-GB"),
              hint:
                audience.suppressed === null
                  ? "The unsubscribe list couldn't be read"
                  : `${audience.contacts.filter((c) => c.kind === "registered").length} with an account · ${audience.contacts.filter((c) => c.kind === "guest").length} guest`,
            },
            {
              label: "Contacts in Brevo",
              value: figure(listTotal),
              hint: settings.lastSyncAt
                ? `Last synced ${when(settings.lastSyncAt)}`
                : "Not synced yet",
            },
            {
              label: "Unsubscribed",
              value: figure(suppressed),
              hint: "Never emailed again, by anyone",
            },
            {
              label: "Campaigns sent",
              value: configured && !brevoError ? String(sent.length) : "—",
              hint: campaigns.length > sent.length ? `${campaigns.length - sent.length} draft or scheduled` : undefined,
            },
          ]}
        />

        {sent.length > 0 && (
          <StatGrid
            stats={[
              { label: "Delivered", value: figure(totals.delivered), hint: `${figure(totals.sent)} sent` },
              {
                label: "Opened",
                value: figure(totals.uniqueViews),
                hint: `${percent(rate(totals.uniqueViews, totals.delivered))} of delivered`,
              },
              {
                label: "Clicked",
                value: figure(totals.uniqueClicks),
                hint: `${percent(rate(totals.uniqueClicks, totals.delivered))} of delivered`,
              },
              {
                label: "Bounced / unsubscribed",
                value: `${figure((totals.hardBounces ?? 0) + (totals.softBounces ?? 0))} / ${figure(totals.unsubscriptions)}`,
                hint: `${figure(totals.complaints)} marked as spam`,
              },
            ]}
          />
        )}

        <Card padded={false}>
          <div className="p-5 sm:p-6">
            <CardHeader
              title="Recent campaigns"
              subtitle="Every figure here is Brevo's own. Opens are approximate — Apple Mail and others pre-load images."
              action={
                <Link
                  href="/admin/marketing/email/campaigns"
                  className="flex items-center gap-1 text-sm font-semibold text-ember-600 hover:text-ember-500"
                >
                  All campaigns <ArrowRight size={15} />
                </Link>
              }
            />
          </div>

          {campaigns.length === 0 ? (
            <div className="flex flex-col items-center gap-3 border-t border-hairline px-5 py-12 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-muted">
                <Mail size={22} />
              </span>
              <p className="text-sm text-muted">
                {configured && !brevoError
                  ? "No campaigns yet. Design a template in Brevo, then compose one here."
                  : "Campaigns will show here once Brevo is connected."}
              </p>
              {configured && !brevoError && (
                <Link
                  href="/admin/marketing/email/compose"
                  className="rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
                >
                  Compose a campaign
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto border-t border-hairline">
              <table className="w-full min-w-[42rem] text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs font-semibold text-faint">
                    <th className="px-5 py-3">Campaign</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Delivered</th>
                    <th className="px-5 py-3 text-right">Opened</th>
                    <th className="px-5 py-3 text-right">Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.slice(0, 10).map((campaign) => {
                    const stats = statsOf(campaign);
                    return (
                      <tr key={campaign.id} className="border-b border-hairline last:border-0">
                        <td className="max-w-[18rem] px-5 py-3">
                          <Link
                            href={`/admin/marketing/email/campaigns/${campaign.id}`}
                            className="block truncate font-medium text-heading hover:text-ember-600"
                          >
                            {campaign.name}
                          </Link>
                          {campaign.subject && (
                            <span className="block truncate text-xs text-faint">{campaign.subject}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <StatusChip status={campaign.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-muted">
                          {when(campaign.sentDate ?? campaign.scheduledAt ?? campaign.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right text-muted">{figure(stats.delivered)}</td>
                        <td className="px-5 py-3 text-right text-muted">
                          {figure(stats.uniqueViews)}
                        </td>
                        <td className="px-5 py-3 text-right text-muted">
                          {figure(stats.uniqueClicks)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </AdminShell>
  );
}
