import Link from "next/link";
import { Mail } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SectionTabs from "@/components/admin/marketing/SectionTabs";
import { StatusChip, when } from "@/components/admin/marketing/format";
import { figure } from "@/components/admin/marketing/StatGrid";
import { BrevoProblem, NotConnected } from "@/components/admin/marketing/NotSetUp";
import { brevoProblem, isBrevoConfigured } from "@/lib/brevo/client";
import { listCampaigns, statsOf, type Campaign } from "@/lib/brevo/campaigns";

export const metadata = { title: "Campaigns" };
export const dynamic = "force-dynamic";

/**
 * Campaign history — read straight out of Brevo, which is the campaign
 * system. We keep no campaigns table of our own, so this list is whatever
 * Brevo says it is, drafts and scheduled ones included.
 *
 * Campaigns built by hand in Brevo's dashboard show here too.
 */
export default async function CampaignsPage() {
  const configured = isBrevoConfigured();

  let campaigns: Campaign[] = [];
  let brevoError: string | null = null;

  if (configured) {
    try {
      campaigns = await listCampaigns(100);
    } catch (error) {
      brevoError = brevoProblem(error);
    }
  }

  const groups: { title: string; note?: string; rows: Campaign[] }[] = [
    {
      title: "Scheduled",
      note: "Waiting to go out. Open one to stop it.",
      rows: campaigns.filter((c) => c.status === "queued" || c.status === "in_process"),
    },
    {
      title: "Drafts",
      note: "Created but never sent — usually a send that failed part-way and can be retried.",
      rows: campaigns.filter((c) => c.status === "draft" || c.status === "in_review"),
    },
    {
      title: "Sent",
      rows: campaigns.filter((c) => c.status === "sent" || c.status === "archive"),
    },
    {
      title: "Stopped",
      rows: campaigns.filter(
        (c) => c.status === "suspended" || c.status === "cancelled" || c.status === "cancelling"
      ),
    },
  ].filter((group) => group.rows.length > 0);

  return (
    <AdminShell title="Campaigns">
      <div className="space-y-4 sm:space-y-6">
        <SectionTabs />

        {!configured && <NotConnected />}
        {brevoError && <BrevoProblem message={brevoError} />}

        {groups.length === 0 && !brevoError && configured && (
          <Card className="flex flex-col items-center gap-3 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-muted">
              <Mail size={22} />
            </span>
            <p className="text-sm text-muted">No campaigns in Brevo yet.</p>
            <Link
              href="/admin/marketing/email/compose"
              className="rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
            >
              Compose one
            </Link>
          </Card>
        )}

        {groups.map((group) => (
          <Card key={group.title} padded={false}>
            <div className="p-5 sm:p-6">
              <CardHeader title={group.title} subtitle={group.note} />
            </div>
            <div className="overflow-x-auto border-t border-hairline">
              <table className="w-full min-w-[46rem] text-sm">
                <thead>
                  <tr className="border-b border-hairline text-left text-xs font-semibold text-faint">
                    <th className="px-5 py-3">Campaign</th>
                    <th className="px-5 py-3">Status</th>
                    <th className="px-5 py-3">Date</th>
                    <th className="px-5 py-3 text-right">Recipients</th>
                    <th className="px-5 py-3 text-right">Delivered</th>
                    <th className="px-5 py-3 text-right">Opened</th>
                    <th className="px-5 py-3 text-right">Clicked</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((campaign) => {
                    const stats = statsOf(campaign);
                    const lists = campaign.recipients?.lists ?? [];
                    const recipients = lists.reduce(
                      (sum, list) => sum + (list.totalSubscribers ?? 0),
                      0
                    );
                    return (
                      <tr key={campaign.id} className="border-b border-hairline last:border-0">
                        <td className="max-w-[20rem] px-5 py-3">
                          <Link
                            href={`/admin/marketing/email/campaigns/${campaign.id}`}
                            className="block truncate font-medium text-heading hover:text-ember-600"
                          >
                            {campaign.name}
                          </Link>
                          <span className="block truncate text-xs text-faint">
                            {campaign.subject || "No subject"}
                          </span>
                        </td>
                        <td className="px-5 py-3">
                          <StatusChip status={campaign.status} />
                        </td>
                        <td className="whitespace-nowrap px-5 py-3 text-muted">
                          {when(campaign.sentDate ?? campaign.scheduledAt ?? campaign.createdAt)}
                        </td>
                        <td className="px-5 py-3 text-right text-muted">
                          {recipients > 0 ? recipients.toLocaleString("en-GB") : "—"}
                        </td>
                        <td className="px-5 py-3 text-right text-muted">{figure(stats.delivered)}</td>
                        <td className="px-5 py-3 text-right text-muted">{figure(stats.uniqueViews)}</td>
                        <td className="px-5 py-3 text-right text-muted">{figure(stats.uniqueClicks)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}
      </div>
    </AdminShell>
  );
}
