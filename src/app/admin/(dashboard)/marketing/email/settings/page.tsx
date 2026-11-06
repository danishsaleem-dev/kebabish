import { CheckCircle2, CircleAlert, Webhook } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SectionTabs from "@/components/admin/marketing/SectionTabs";
import { MigrationMissing } from "@/components/admin/marketing/NotSetUp";
import { howLongAgo } from "@/components/admin/marketing/format";
import { Field, Input, SubmitButton } from "@/components/admin/ui/Form";
import { brevoProblem, getBrevoAccount, isBrevoConfigured } from "@/lib/brevo/client";
import { isMarketingSchemaReady, readListState } from "@/lib/brevo/contacts";
import { supabaseStore } from "@/lib/brevo/settings";
import { siteConfig } from "@/lib/site-config";
import { connectBrevoAction, saveSenderAction } from "../actions";

export const metadata = { title: "Brevo settings" };
export const dynamic = "force-dynamic";

/**
 * The integration's own settings.
 *
 * The API key is **not** shown or editable here, and never reaches the
 * browser — it is an environment variable, like the Mollie and Resend keys.
 * What this screen can tell you is whether it works, which account it belongs
 * to, and what Brevo currently holds.
 */
export default async function BrevoSettingsPage() {
  const configured = isBrevoConfigured();

  const [settings, schemaReady] = await Promise.all([
    supabaseStore.read(),
    isMarketingSchemaReady(),
  ]);

  let account: Awaited<ReturnType<typeof getBrevoAccount>> | null = null;
  let problem: string | null = null;
  if (configured) {
    try {
      account = await getBrevoAccount();
    } catch (error) {
      problem = brevoProblem(error);
    }
  }

  const list = configured && !problem ? await readListState() : null;
  const webhookUrl = `${siteConfig.website}/api/brevo/webhook`;

  return (
    <AdminShell title="Brevo settings">
      <div className="space-y-4 sm:space-y-6">
        <SectionTabs />

        {!schemaReady && <MigrationMissing />}

        <Card>
          <CardHeader title="Connection" />

          <div className="mt-4 space-y-4">
            <Row
              ok={configured}
              label="API key"
              value={
                configured
                  ? "Set in the environment variables"
                  : "Not set — add BREVO_API_KEY and redeploy"
              }
            />
            <Row
              ok={Boolean(account) && !problem}
              label="Brevo account"
              value={
                problem
                  ? problem
                  : account
                    ? `${account.companyName} · ${account.email}`
                    : "Not checked"
              }
            />
            <Row
              ok={Boolean(settings.listId)}
              label="Subscribers list"
              value={
                settings.listId
                  ? `Kebabish subscribers (#${settings.listId})${
                      list?.totalSubscribers !== undefined
                        ? ` · ${list.totalSubscribers.toLocaleString("en-GB")} contacts`
                        : ""
                    }`
                  : "Not created yet — press Connect"
              }
            />
            <Row
              ok={Boolean(settings.lastSyncAt)}
              label="Contacts synced"
              value={
                settings.lastSyncAt
                  ? `${howLongAgo(settings.lastSyncAt)} · ${(settings.lastSyncCount ?? 0).toLocaleString("en-GB")} contacts`
                  : "Never"
              }
            />
          </div>

          <form action={connectBrevoAction} className="mt-5 border-t border-hairline pt-4">
            <SubmitButton disabled={!configured}>
              {settings.listId ? "Check the connection again" : "Connect"}
            </SubmitButton>
            <p className="mt-1.5 text-xs text-muted">
              Creates the subscribers list, the folder for one-off sends, and the contact
              attributes personalisation needs. Safe to press again — it looks before it creates
              anything.
            </p>
          </form>
        </Card>

        <Card>
          <CardHeader
            title="Sender"
            subtitle="Who campaigns come from. It has to be a verified sender in Brevo as well, or Brevo refuses the campaign."
          />

          <form action={saveSenderAction} className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Name">
              <Input
                name="senderName"
                defaultValue={settings.senderName ?? siteConfig.brandName}
                maxLength={70}
                required
              />
            </Field>
            <Field label="Email">
              <Input
                name="senderEmail"
                type="email"
                defaultValue={settings.senderEmail ?? siteConfig.contact.email}
                required
              />
            </Field>
            <div className="sm:col-span-2">
              <SubmitButton>Save sender</SubmitButton>
            </div>
          </form>

          <p className="mt-3 text-xs text-faint">
            Brevo needs its own DKIM records on this domain. They sit alongside Resend&apos;s
            quite happily — different selectors — so adding them does not affect receipts,
            password resets or order emails, which keep going through Resend.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="Webhook"
            subtitle="How an unsubscribe gets back to us. Without it, somebody could unsubscribe in an email and still be in the audience here."
          />

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-muted">URL to paste into Brevo</p>
              <code className="mt-1 block overflow-x-auto rounded-lg bg-canvas px-3 py-2 text-xs text-heading">
                {webhookUrl}
              </code>
            </div>

            <Row
              ok={Boolean(process.env.BREVO_WEBHOOK_SECRET)}
              label="Shared token"
              value={
                process.env.BREVO_WEBHOOK_SECRET
                  ? "Set — the endpoint refuses anything without it"
                  : "Not set. BREVO_WEBHOOK_SECRET is required; until it is set the endpoint refuses every request rather than accepting any."
              }
            />

            <div className="rounded-xl border border-hairline bg-canvas p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-heading">
                <Webhook size={15} /> Setting it up in Brevo
              </p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
                <li>
                  In Brevo: <strong>Settings → Webhooks → Add a webhook</strong>, for{" "}
                  <strong>Marketing</strong> (not transactional).
                </li>
                <li>Paste the URL above.</li>
                <li>
                  Tick <strong>Unsubscribed</strong>, <strong>Hard bounce</strong>,{" "}
                  <strong>Soft bounce</strong> and <strong>Marked as spam</strong>. Opens and
                  clicks are deliberately left off — Brevo already reports those per campaign, and
                  storing every one of them here would be the biggest table in the database for
                  nothing.
                </li>
                <li>
                  Under the authentication options choose a <strong>bearer token</strong> and paste
                  the value of <code className="rounded bg-hairline px-1">BREVO_WEBHOOK_SECRET</code>.
                  Brevo does not sign its webhooks, so this token is what proves a call is really
                  from Brevo.
                </li>
              </ol>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="What is Brevo's and what is ours" />
          <div className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
            <div>
              <p className="font-semibold text-heading">Brevo does</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
                <li>The drag-and-drop editor and every template</li>
                <li>Actually sending, and the unsubscribe link</li>
                <li>The blocklist, bounces and spam complaints</li>
                <li>All delivery, open and click statistics</li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-heading">We do</p>
              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-muted">
                <li>Who the customers are, and who consented</li>
                <li>Keeping an unsubscribe out of the audience for good</li>
                <li>Choosing recipients and pressing send</li>
                <li>
                  Every transactional email — receipts, invoices, password resets, order
                  updates — which goes through Resend and is untouched by any of this
                </li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}

function Row({ ok, label, value }: { ok: boolean; label: string; value: string }) {
  return (
    <div className="flex gap-3">
      {ok ? (
        <CheckCircle2 className="mt-0.5 shrink-0 text-success" size={18} />
      ) : (
        <CircleAlert className="mt-0.5 shrink-0 text-warn" size={18} />
      )}
      <div className="min-w-0">
        <p className="text-sm font-medium text-heading">{label}</p>
        <p className="text-sm text-muted">{value}</p>
      </div>
    </div>
  );
}
