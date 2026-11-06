import { RefreshCw } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import SectionTabs from "@/components/admin/marketing/SectionTabs";
import StatGrid, { figure } from "@/components/admin/marketing/StatGrid";
import ContactsTable, {
  type ContactRow,
  type SuppressedRow,
} from "@/components/admin/marketing/ContactsTable";
import { MigrationMissing, NotConnected } from "@/components/admin/marketing/NotSetUp";
import { howLongAgo, when } from "@/components/admin/marketing/format";
import { SubmitButton } from "@/components/admin/ui/Form";
import { isBrevoConfigured } from "@/lib/brevo/client";
import { readAudience } from "@/lib/brevo/contacts";
import { listSuppressions } from "@/lib/brevo/suppressions";
import { supabaseStore } from "@/lib/brevo/settings";
import { supabaseAdmin } from "@/lib/supabase/server";
import { syncContactsAction } from "../actions";

export const metadata = { title: "Marketing contacts" };
export const dynamic = "force-dynamic";

/**
 * The audience, from our own database.
 *
 * This screen is the honest answer to "who will actually receive a campaign",
 * and it is computed here rather than read from Brevo on purpose: our tables
 * are where consent lives, and if the two ever disagree it is this list that
 * is right and the sync that needs running.
 */
export default async function MarketingContactsPage() {
  const [audience, suppressions, settings] = await Promise.all([
    readAudience(),
    listSuppressions(500),
    supabaseStore.read(),
  ]);

  const syncedByCustomer = await readSyncTimes(
    audience.contacts.map((contact) => contact.customerId).filter(Boolean) as string[]
  );

  const contacts: ContactRow[] = audience.contacts.map((contact) => ({
    email: contact.email,
    name: contact.name,
    kind: contact.kind,
    orderCount: contact.stats.orderCount,
    language: contact.stats.language,
    consentAt: when(contact.consentAt),
    syncedAt: contact.customerId
      ? syncedByCustomer.get(contact.customerId)
        ? when(syncedByCustomer.get(contact.customerId))
        : null
      : settings.lastSyncAt
        ? when(settings.lastSyncAt)
        : null,
  }));

  const suppressed: SuppressedRow[] = suppressions.map((row) => ({
    email: row.email,
    reason: row.reason,
    at: when(row.at),
  }));

  return (
    <AdminShell title="Marketing contacts">
      <div className="space-y-4 sm:space-y-6">
        <SectionTabs />

        {!audience.schemaReady && <MigrationMissing />}
        {!isBrevoConfigured() && <NotConnected />}

        <StatGrid
          stats={[
            {
              label: "Can be emailed",
              value: audience.suppressed === null ? "—" : figure(audience.contacts.length),
              hint:
                audience.suppressed === null
                  ? "The unsubscribe list couldn't be read"
                  : `${audience.contacts.filter((c) => c.kind === "registered").length} with an account · ${audience.contacts.filter((c) => c.kind === "guest").length} guest`,
            },
            { label: "Unsubscribed or bounced", value: figure(suppressions.length) },
            {
              label: "Excluded by that",
              value: figure(audience.suppressedCount),
              hint: "People who opted in but have since been suppressed",
            },
            {
              label: "Last synced",
              value: howLongAgo(settings.lastSyncAt),
              hint: settings.lastSyncCount
                ? `${settings.lastSyncCount.toLocaleString("en-GB")} contacts pushed`
                : undefined,
            },
          ]}
        />

        <Card>
          <CardHeader
            title="Sync to Brevo"
            subtitle="Pushes everyone below to Brevo in one request, updating names, order counts and language for personalisation. Runs by itself once a day too."
            action={
              <form action={syncContactsAction}>
                <SubmitButton disabled={!isBrevoConfigured()}>
                  <RefreshCw size={15} /> Sync contacts now
                </SubmitButton>
              </form>
            }
          />
          <p className="mt-3 text-xs text-faint">
            Syncing never subscribes anybody: it sends only the people already listed below, and
            it cannot clear a block Brevo is holding. Nobody who hasn&apos;t opted in is sent to
            Brevo at all.
          </p>
        </Card>

        <ContactsTable contacts={contacts} suppressed={suppressed} />
      </div>
    </AdminShell>
  );
}

/** Per-customer sync times, so a row can say "not yet" for one that never landed. */
async function readSyncTimes(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();

  const { data, error } = await supabaseAdmin()
    .from("customers")
    .select("id, brevo_synced_at")
    .in("id", ids);

  // Before migration 0032 the column isn't there; the table just shows "not yet".
  if (error) return new Map();

  const map = new Map<string, string>();
  for (const row of data ?? []) {
    const record = row as { id: string; brevo_synced_at: string | null };
    if (record.brevo_synced_at) map.set(record.id, record.brevo_synced_at);
  }
  return map;
}
