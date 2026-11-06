"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { OWNER_STAFF, requireRole } from "@/lib/admin/guard";
import { flashRedirect } from "@/lib/admin/flash";
import { amsterdamLocalToUtc } from "@/lib/delivery-slots";
import { brevoProblem, clearBrevoCache, isBrevoConfigured } from "@/lib/brevo/client";
import { isSendableEmail, normalizeEmail, resolveRecipients } from "@/lib/brevo/audience";
import {
  ensureBrevoSetup,
  readAudience,
  syncAudienceToBrevo,
} from "@/lib/brevo/contacts";
import {
  alreadySent,
  createCampaign,
  createSelectionList,
  deleteCampaign,
  deleteList,
  rememberSend,
  sendCampaignNow,
  sendCampaignTest,
  sendKey,
  suspendCampaign,
} from "@/lib/brevo/campaigns";
import { supabaseStore } from "@/lib/brevo/settings";
import { getTemplate } from "@/lib/brevo/templates";

/**
 * Every action here calls `requireRole` itself. The `OwnerStaffOnly` layout
 * protects the *pages*; a server action is a public POST endpoint in its own
 * right, so a manager or a customer holding a session could call one directly.
 *
 * Danish's call: owner **and** staff may send, the same as Promo codes.
 */

const PATH = "/admin/marketing/email";

function publish(): void {
  clearBrevoCache();
  revalidatePath(PATH, "layout");
}

/* ------------------------------------------------------------- connect */

export async function connectBrevoAction(): Promise<void> {
  await requireRole(OWNER_STAFF);

  if (!isBrevoConfigured()) {
    redirect(flashRedirect(`${PATH}/settings`, "No Brevo API key is set.", "error"));
  }

  try {
    await ensureBrevoSetup();
  } catch (error) {
    redirect(flashRedirect(`${PATH}/settings`, brevoProblem(error), "error"));
  }

  publish();
  redirect(flashRedirect(`${PATH}/settings`, "Connected to Brevo.", "success"));
}

export async function saveSenderAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF);

  const name = String(formData.get("senderName") ?? "").trim();
  const email = normalizeEmail(String(formData.get("senderEmail") ?? ""));

  if (!name || name.length > 70) {
    redirect(flashRedirect(`${PATH}/settings`, "Give the sender a name (up to 70 characters).", "error"));
  }
  if (!isSendableEmail(email)) {
    redirect(flashRedirect(`${PATH}/settings`, "That sender address doesn't look right.", "error"));
  }

  await supabaseStore.update({ senderName: name, senderEmail: email });
  publish();
  redirect(
    flashRedirect(
      `${PATH}/settings`,
      "Sender saved. It has to be a verified sender in Brevo as well, or campaigns will be refused.",
      "success"
    )
  );
}

/* ---------------------------------------------------------------- sync */

export async function syncContactsAction(): Promise<void> {
  await requireRole(OWNER_STAFF);

  let result;
  try {
    result = await syncAudienceToBrevo();
  } catch (error) {
    redirect(flashRedirect(`${PATH}/contacts`, brevoProblem(error), "error"));
  }

  publish();

  if (!result.ok) {
    redirect(flashRedirect(`${PATH}/contacts`, result.problem ?? "The sync didn't run.", "error"));
  }

  redirect(
    flashRedirect(
      `${PATH}/contacts`,
      result.count === 1
        ? "1 contact synced to Brevo."
        : `${result.count.toLocaleString("en-GB")} contacts synced to Brevo.`,
      "success"
    )
  );
}

/* ------------------------------------------------------------ sending */

type RecipientMode = "all" | "selected";

interface SendPlan {
  templateId: number;
  subject: string;
  previewText: string;
  mode: RecipientMode;
  emails: string[];
  scheduledAt: string | null;
  testTo: string;
}

function readPlan(formData: FormData): SendPlan {
  const templateId = Number(formData.get("templateId"));
  const mode: RecipientMode = formData.get("mode") === "selected" ? "selected" : "all";

  // The selection travels as a newline/comma-separated list of addresses, not
  // of customer ids: the server re-checks every one of them against the real
  // audience anyway, so ids would buy nothing and leak more.
  const emails = String(formData.get("recipients") ?? "")
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter(Boolean);

  const when = String(formData.get("when") ?? "now");
  let scheduledAt: string | null = null;
  if (when === "schedule") {
    const date = String(formData.get("scheduleDate") ?? "").trim();
    const time = String(formData.get("scheduleTime") ?? "").trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(date) && /^\d{2}:\d{2}$/.test(time)) {
      // The admin types Amsterdam wall-clock time; Brevo wants UTC.
      scheduledAt = amsterdamLocalToUtc(date, time).toISOString();
    }
  }

  return {
    templateId,
    subject: String(formData.get("subject") ?? "").trim(),
    previewText: String(formData.get("previewText") ?? "").trim(),
    mode,
    emails,
    scheduledAt,
    testTo: normalizeEmail(String(formData.get("testTo") ?? "")),
  };
}

/** Everything both the test and the real send have to establish first. */
async function prepare(plan: SendPlan, backTo: string) {
  if (!isBrevoConfigured()) {
    redirect(flashRedirect(backTo, "No Brevo API key is set.", "error"));
  }
  if (!Number.isFinite(plan.templateId) || plan.templateId <= 0) {
    redirect(flashRedirect(backTo, "Choose a template first.", "error"));
  }
  if (plan.subject.length < 2 || plan.subject.length > 200) {
    redirect(flashRedirect(backTo, "Give the email a subject (2–200 characters).", "error"));
  }

  const template = await getTemplate(plan.templateId);
  if (!template) {
    redirect(
      flashRedirect(
        backTo,
        "That template isn't in Brevo any more, or it isn't active. Pick another.",
        "error"
      )
    );
  }

  const snapshot = await readAudience();

  // The one refusal that is not about convenience: without the unsubscribe
  // mirror we cannot prove somebody hasn't opted out, so nothing goes out.
  if (snapshot.suppressed === null) {
    redirect(
      flashRedirect(
        backTo,
        "The unsubscribe list couldn't be read, so nothing was sent. Run migration 0032 and try again.",
        "error"
      )
    );
  }

  const recipients =
    plan.mode === "all"
      ? { eligible: snapshot.contacts.map((contact) => contact.email), skipped: [] }
      : resolveRecipients(plan.emails, snapshot.contacts, snapshot.suppressed);

  if (recipients.eligible.length === 0) {
    redirect(
      flashRedirect(
        backTo,
        plan.mode === "all"
          ? "Nobody has opted in to marketing email yet, so there is nobody to send to."
          : "None of the addresses you picked may be emailed — they haven't opted in, or they unsubscribed.",
        "error"
      )
    );
  }

  const contacts = snapshot.contacts.filter((contact) =>
    recipients.eligible.includes(contact.email)
  );

  return { template, recipients, contacts, snapshot };
}

/**
 * Which Brevo list a send is addressed to.
 *
 * "Everyone" uses the standing subscribers list. A selection gets a list of
 * its own, filed in the one-off folder — Brevo can only address a campaign to
 * a list or a segment, so there is no way around creating one. The second
 * return value says whether we made it, and may therefore delete it.
 */
async function listFor(
  plan: SendPlan,
  contacts: Awaited<ReturnType<typeof prepare>>["contacts"],
  label: string
): Promise<{ listId: number; disposable: boolean }> {
  if (plan.mode === "all") {
    const { listId } = await ensureBrevoSetup();
    return { listId, disposable: false };
  }
  const listId = await createSelectionList(label, contacts);
  return { listId, disposable: true };
}

/** Amsterdam time, for naming a campaign and a selection list. */
function stamp(): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Amsterdam",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date());
}

/**
 * Send a test copy.
 *
 * Brevo can only test a campaign that exists, so this builds a draft, tests
 * it, then **removes the draft and any list it created** — the campaign
 * history should only ever hold real campaigns, not a trail of a dozen tests.
 */
export async function sendTestAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF);

  const back = `${PATH}/compose`;
  const plan = readPlan(formData);

  if (!isSendableEmail(plan.testTo)) {
    redirect(flashRedirect(back, "Put in an address to send the test to.", "error"));
  }

  const { contacts } = await prepare(plan, back);

  let listId: number | null = null;
  let disposable = false;
  let campaignId: number | null = null;

  try {
    const list = await listFor(plan, contacts, `Test · ${stamp()}`);
    listId = list.listId;
    disposable = list.disposable;

    campaignId = await createCampaign({
      name: `[test] ${plan.subject} · ${stamp()}`,
      subject: plan.subject,
      previewText: plan.previewText,
      templateId: plan.templateId,
      listIds: [listId],
    });

    await sendCampaignTest(campaignId, [plan.testTo]);
  } catch (error) {
    redirect(flashRedirect(back, brevoProblem(error), "error"));
  } finally {
    // Tidy up whichever of these got made, success or failure.
    if (campaignId) await deleteCampaign(campaignId);
    if (listId && disposable) await deleteList(listId);
    publish();
  }

  redirect(flashRedirect(back, `Test sent to ${plan.testTo}.`, "success"));
}

/**
 * Create the campaign and send or schedule it.
 *
 * The order matters. The draft is created first and sent second, rather than
 * passing `scheduledAt: now` in one call: if the send step fails, the draft
 * exists in the history and can be retried, instead of leaving a half-made
 * thing nobody can find. A genuinely scheduled campaign is created *with*
 * `scheduledAt`, which is what Brevo wants, and no send call follows.
 */
export async function sendCampaignAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF);

  const back = `${PATH}/compose`;
  const plan = readPlan(formData);

  // A campaign cannot be unsent, so the dialog in front of this makes the
  // admin type the word. The server checks it too.
  if (String(formData.get("confirm") ?? "").trim().toUpperCase() !== "SEND") {
    redirect(flashRedirect(back, "Type SEND to confirm before a campaign goes out.", "error"));
  }

  const { recipients, contacts } = await prepare(plan, back);

  if (String(formData.get("when") ?? "now") === "schedule" && !plan.scheduledAt) {
    redirect(flashRedirect(back, "Pick a date and time to schedule it for.", "error"));
  }
  if (plan.scheduledAt && Date.parse(plan.scheduledAt) < Date.now() + 60_000) {
    redirect(flashRedirect(back, "Schedule it at least a minute from now.", "error"));
  }

  // Double-click guard: a hash of exactly this submission, claimed before
  // Brevo is called. A repeat within the hour is answered with the campaign
  // that already exists instead of sending a second one.
  const key = sendKey({
    templateId: plan.templateId,
    subject: plan.subject,
    recipients: recipients.eligible,
    scheduledAt: plan.scheduledAt,
  });

  const existing = await alreadySent(key);
  if (existing) {
    redirect(
      flashRedirect(
        `${PATH}/campaigns/${existing}`,
        "That campaign had already been sent — this is it.",
        "info"
      )
    );
  }

  const label = `${plan.subject} · ${stamp()}`;
  let listId: number | null = null;
  let disposable = false;
  let campaignId: number | null = null;

  try {
    const list = await listFor(plan, contacts, `Selection · ${stamp()}`);
    listId = list.listId;
    disposable = list.disposable;

    campaignId = await createCampaign({
      name: label,
      subject: plan.subject,
      previewText: plan.previewText,
      templateId: plan.templateId,
      listIds: [listId],
      scheduledAt: plan.scheduledAt,
    });

    await rememberSend(key, campaignId);

    if (!plan.scheduledAt) await sendCampaignNow(campaignId);
  } catch (error) {
    // Nothing went out, so take the list back — but keep a draft campaign if
    // one was made: it is visible in the history and can be retried.
    if (!campaignId && listId && disposable) await deleteList(listId);
    publish();
    redirect(flashRedirect(back, brevoProblem(error), "error"));
  }

  publish();

  const count = recipients.eligible.length;
  const who = count === 1 ? "1 person" : `${count.toLocaleString("en-GB")} people`;
  const skipped = recipients.skipped.length;
  const note = skipped
    ? ` ${skipped} address${skipped === 1 ? "" : "es"} skipped (not opted in, or unsubscribed).`
    : "";

  redirect(
    flashRedirect(
      `${PATH}/campaigns/${campaignId}`,
      plan.scheduledAt
        ? `Scheduled for ${who}.${note}`
        : `Sending to ${who}.${note} Brevo delivers it over the next few minutes.`,
      "success"
    )
  );
}

/** Stop a scheduled campaign that hasn't gone out yet. */
export async function cancelCampaignAction(formData: FormData): Promise<void> {
  await requireRole(OWNER_STAFF);

  const id = Number(formData.get("campaignId"));
  if (!Number.isFinite(id) || id <= 0) {
    redirect(flashRedirect(`${PATH}/campaigns`, "That campaign couldn't be found.", "error"));
  }

  try {
    await suspendCampaign(id);
  } catch (error) {
    redirect(flashRedirect(`${PATH}/campaigns/${id}`, brevoProblem(error), "error"));
  }

  publish();
  redirect(flashRedirect(`${PATH}/campaigns/${id}`, "Campaign stopped.", "success"));
}
