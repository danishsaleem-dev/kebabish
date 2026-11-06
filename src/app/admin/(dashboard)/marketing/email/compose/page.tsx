import AdminShell from "@/components/admin/AdminShell";
import SectionTabs from "@/components/admin/marketing/SectionTabs";
import ComposeForm, {
  type RecipientOption,
  type TemplateOption,
} from "@/components/admin/marketing/ComposeForm";
import { BrevoProblem, MigrationMissing, NotConnected } from "@/components/admin/marketing/NotSetUp";
import { brevoProblem, isBrevoConfigured } from "@/lib/brevo/client";
import { readAudience } from "@/lib/brevo/contacts";
import {
  PREVIEW_SAMPLE,
  hasUnsubscribeTag,
  listTemplates,
  personalisationTags,
  previewHtml,
} from "@/lib/brevo/templates";
import { when } from "@/components/admin/marketing/format";
import { siteConfig } from "@/lib/site-config";
import { auth } from "@/lib/auth";
import { sendCampaignAction, sendTestAction } from "../actions";

export const metadata = { title: "Compose a campaign" };
export const dynamic = "force-dynamic";

/**
 * Compose.
 *
 * The template HTML is turned into preview HTML **on the server**, so the
 * browser never receives raw template syntax and the sample values live in
 * one place. The recipient list is already filtered to people who opted in —
 * the page has no way to name anybody else, and the action re-checks every
 * address anyway.
 */
export default async function ComposePage() {
  const configured = isBrevoConfigured();

  const [audience, session] = await Promise.all([readAudience(), auth()]);

  let templates: TemplateOption[] = [];
  let brevoError: string | null = null;

  if (configured) {
    try {
      templates = (await listTemplates()).map((template) => ({
        id: template.id,
        name: template.name,
        subject: template.subject,
        preview: previewHtml(template.htmlContent ?? "", PREVIEW_SAMPLE),
        tags: personalisationTags(template.htmlContent ?? ""),
        hasUnsubscribe: hasUnsubscribeTag(template.htmlContent ?? ""),
        modifiedAt: when(template.modifiedAt),
      }));
    } catch (error) {
      brevoError = brevoProblem(error);
    }
  }

  const recipients: RecipientOption[] = audience.contacts.map((contact) => ({
    email: contact.email,
    name: contact.name,
    kind: contact.kind,
    orderCount: contact.stats.orderCount,
  }));

  return (
    <AdminShell title="Compose a campaign">
      <div className="space-y-4 sm:space-y-6">
        <SectionTabs />

        {!audience.schemaReady && <MigrationMissing />}
        {!configured && <NotConnected />}
        {brevoError && <BrevoProblem message={brevoError} />}

        <ComposeForm
          templates={templates}
          recipients={recipients}
          defaultTestTo={session?.user.email ?? siteConfig.contact.email}
          canSend={configured && audience.suppressed !== null}
          sendAction={sendCampaignAction}
          testAction={sendTestAction}
        />
      </div>
    </AdminShell>
  );
}
