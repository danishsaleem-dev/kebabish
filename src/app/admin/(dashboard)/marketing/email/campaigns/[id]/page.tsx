import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SectionTabs from "@/components/admin/marketing/SectionTabs";
import StatGrid, { figure, percent } from "@/components/admin/marketing/StatGrid";
import { StatusChip, when } from "@/components/admin/marketing/format";
import { BrevoProblem } from "@/components/admin/marketing/NotSetUp";
import { brevoProblem, isBrevoConfigured } from "@/lib/brevo/client";
import { getCampaign, isScheduled, rate, statsOf } from "@/lib/brevo/campaigns";
import { cancelCampaignAction } from "../../actions";

export const metadata = { title: "Campaign" };
export const dynamic = "force-dynamic";

/**
 * One campaign, with Brevo's own figures.
 *
 * Nothing is derived beyond the two obvious rates (opened and clicked, both
 * as a share of delivered). The brief is explicit about not inventing
 * statistics, so a figure Brevo didn't give shows as "—".
 */
export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const campaignId = Number(id);
  if (!Number.isFinite(campaignId) || campaignId <= 0) notFound();

  if (!isBrevoConfigured()) notFound();

  let campaign;
  let brevoError: string | null = null;
  try {
    campaign = await getCampaign(campaignId);
  } catch (error) {
    brevoError = brevoProblem(error);
  }

  if (brevoError) {
    return (
      <AdminShell title="Campaign">
        <div className="space-y-4 sm:space-y-6">
          <SectionTabs />
          <BrevoProblem message={brevoError} />
        </div>
      </AdminShell>
    );
  }

  if (!campaign) notFound();

  const stats = statsOf(campaign);
  const lists = campaign.recipients?.lists ?? [];
  const recipients = lists.reduce((sum, list) => sum + (list.totalSubscribers ?? 0), 0);

  return (
    <AdminShell title="Campaign">
      <div className="space-y-4 sm:space-y-6">
        <SectionTabs />

        <Link
          href="/admin/marketing/email/campaigns"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-muted hover:text-heading"
        >
          <ArrowLeft size={15} /> All campaigns
        </Link>

        <Card>
          <CardHeader
            title={campaign.name}
            subtitle={campaign.subject || undefined}
            action={<StatusChip status={campaign.status} />}
          />

          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted">Created</dt>
              <dd className="font-medium text-heading">{when(campaign.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-muted">{campaign.sentDate ? "Sent" : "Scheduled for"}</dt>
              <dd className="font-medium text-heading">
                {when(campaign.sentDate ?? campaign.scheduledAt)}
              </dd>
            </div>
            <div>
              <dt className="text-muted">Recipients</dt>
              <dd className="font-medium text-heading">
                {recipients > 0 ? recipients.toLocaleString("en-GB") : "—"}
                {lists.length > 0 && (
                  <span className="block text-xs font-normal text-faint">
                    {lists.map((list) => list.name).join(", ")}
                  </span>
                )}
              </dd>
            </div>
          </dl>

          {isScheduled(campaign) && (
            <form action={cancelCampaignAction} className="mt-5 border-t border-hairline pt-4">
              <input type="hidden" name="campaignId" value={campaign.id} />
              <button
                type="submit"
                className="rounded-lg border border-danger px-4 py-2.5 text-sm font-semibold text-danger transition-colors hover:bg-danger-soft"
              >
                Stop this campaign
              </button>
              <p className="mt-1.5 text-xs text-muted">
                It stays in Brevo as a stopped campaign rather than being deleted.
              </p>
            </form>
          )}
        </Card>

        <StatGrid
          stats={[
            { label: "Sent", value: figure(stats.sent) },
            {
              label: "Delivered",
              value: figure(stats.delivered),
              hint: `${percent(rate(stats.delivered, stats.sent))} of sent`,
            },
            {
              label: "Opened",
              value: figure(stats.uniqueViews),
              hint: `${percent(rate(stats.uniqueViews, stats.delivered))} of delivered · ${figure(stats.viewed)} opens in total`,
            },
            {
              label: "Clicked",
              value: figure(stats.uniqueClicks),
              hint: `${percent(rate(stats.uniqueClicks, stats.delivered))} of delivered · ${figure(stats.clickers)} people`,
            },
          ]}
        />

        <StatGrid
          stats={[
            { label: "Hard bounces", value: figure(stats.hardBounces), hint: "Address doesn't exist" },
            { label: "Soft bounces", value: figure(stats.softBounces), hint: "Temporary — mailbox full, server busy" },
            {
              label: "Unsubscribed",
              value: figure(stats.unsubscriptions),
              hint: "Already excluded from every future campaign",
            },
            { label: "Marked as spam", value: figure(stats.complaints) },
          ]}
        />

        <Card>
          <p className="text-sm text-muted">
            These are Brevo&apos;s own figures, read live — there is no copy of them here.
            Open rates are approximate everywhere: Apple Mail and some corporate mail servers
            pre-load images, which counts as an open nobody made. Clicks are the number worth
            watching.
          </p>
        </Card>
      </div>
    </AdminShell>
  );
}
