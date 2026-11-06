import "server-only";
import {
  brevoDelete,
  brevoPost,
  brevoPut,
  cachedGet,
  clearBrevoCache,
} from "@/lib/brevo/client";
import { campaignSender, supabaseStore } from "@/lib/brevo/settings";
import { buildImportRows, type MarketingContact } from "@/lib/brevo/audience";
import { ensureBrevoSetup } from "@/lib/brevo/contacts";

/**
 * Campaigns — created, tested, sent and reported on entirely by Brevo.
 *
 * We keep no campaigns table. Brevo *is* the campaign system: it holds the
 * draft, the schedule, the recipient list, the unsubscribe link and every
 * statistic. The admin screens read `GET /v3/emailCampaigns`.
 *
 * **Why an individual marketing email is still a campaign.** Brevo can only
 * address a campaign to lists or segments — there is no "send to these three
 * addresses". The obvious shortcut would be `POST /v3/smtp/email` with a
 * `templateId`, but that is a *transactional* send: no unsubscribe link, the
 * blocklist ignored, and nothing in the campaign statistics. So a send to one
 * person becomes a list of one and a real campaign. One extra API call buys
 * all three back, and means an admin cannot accidentally email somebody who
 * has unsubscribed.
 */

export type CampaignStatus =
  | "draft"
  | "sent"
  | "archive"
  | "queued"
  | "suspended"
  | "in_process"
  | "in_review"
  | "cancelling"
  | "cancelled";

export interface CampaignStats {
  sent: number | null;
  delivered: number | null;
  hardBounces: number | null;
  softBounces: number | null;
  unsubscriptions: number | null;
  complaints: number | null;
  viewed: number | null;
  uniqueViews: number | null;
  clickers: number | null;
  uniqueClicks: number | null;
}

export interface Campaign {
  id: number;
  name: string;
  subject?: string;
  status: CampaignStatus;
  type: string;
  createdAt: string;
  modifiedAt: string;
  scheduledAt?: string;
  sentDate?: string;
  tag?: string;
  recipients?: { lists?: { id: number; name: string; totalSubscribers?: number }[] };
  statistics?: { globalStats?: Partial<CampaignStats> };
}

interface CampaignListResponse {
  count: number;
  campaigns: Campaign[] | null;
}

/*
 * No campaign tag. Brevo's `tag` option is plan-restricted — a free account
 * answers 405 "not allowed to avail tag option" — and it only ever served to
 * label our campaigns in the history. Not worth failing a send over.
 */

/** An empty stats block, so a caller never has to guard every field. */
export const NO_STATS: CampaignStats = {
  sent: null,
  delivered: null,
  hardBounces: null,
  softBounces: null,
  unsubscriptions: null,
  complaints: null,
  viewed: null,
  uniqueViews: null,
  clickers: null,
  uniqueClicks: null,
};

export function statsOf(campaign: Campaign): CampaignStats {
  return { ...NO_STATS, ...(campaign.statistics?.globalStats ?? {}) };
}

/**
 * Campaign history, newest first.
 *
 * Cached — campaign endpoints allow **100 requests an hour** between them all,
 * which a dashboard that reads on every render would burn through in an
 * afternoon. `statistics=globalStats` keeps the response small; Brevo only
 * returns event data from the last six months there, which is well past what
 * this screen shows.
 */
export async function listCampaigns(limit = 50): Promise<Campaign[]> {
  const response = await cachedGet<CampaignListResponse>(
    `/emailCampaigns?limit=${limit}&offset=0&sort=desc&statistics=globalStats&excludeHtmlContent=true`
  );
  return response.campaigns ?? [];
}

export async function getCampaign(id: number): Promise<Campaign | null> {
  try {
    return await cachedGet<Campaign>(`/emailCampaigns/${id}?statistics=globalStats`);
  } catch {
    return null;
  }
}

/* ------------------------------------------------------- recipient lists */

/**
 * Put a chosen set of contacts into a Brevo list of their own, and return its id.
 *
 * Kept, not deleted after the send: Brevo's campaign report refers to the
 * list, so deleting it would take the statistics with it. They are filed in
 * the "one-off sends" folder, out of the way of the standing subscribers list.
 */
export async function createSelectionList(
  label: string,
  contacts: MarketingContact[]
): Promise<number> {
  const { folderId } = await ensureBrevoSetup();

  const created = await brevoPost<{ id: number }>("/contacts/lists", {
    name: label.slice(0, 50),
    folderId,
  });

  const rows = buildImportRows(contacts);
  if (rows.length > 0) {
    await brevoPost("/contacts/import", {
      listIds: [created.id],
      jsonBody: rows,
      updateExistingContacts: true,
      emptyContactsAttributes: false,
      emailBlacklist: false,
      smsBlacklist: false,
      disableNotification: true,
    });
  }

  clearBrevoCache();
  return created.id;
}

/**
 * Remove a draft campaign.
 *
 * Only ever used on the throwaway draft a test send needs — Brevo can only
 * test a campaign that exists, and the history should hold real campaigns
 * rather than a trail of tests. Brevo refuses to delete one that has gone
 * out, which is exactly the protection we would want anyway.
 */
export async function deleteCampaign(campaignId: number): Promise<void> {
  try {
    await brevoDelete(`/emailCampaigns/${campaignId}`);
    clearBrevoCache();
  } catch (error) {
    console.error(`[brevo] could not remove the test campaign ${campaignId}:`, error);
  }
}

/** Only used to clean up after a failure part-way through a send. */
export async function deleteList(listId: number): Promise<void> {
  try {
    await brevoDelete(`/contacts/lists/${listId}`);
  } catch (error) {
    console.error(`[brevo] could not remove list ${listId}:`, error);
  }
}

/* ----------------------------------------------------------- the send */

export interface CreateCampaignInput {
  name: string;
  subject: string;
  templateId: number;
  listIds: number[];
  /** ISO instant. Absent means "send as soon as it is created". */
  scheduledAt?: string | null;
  previewText?: string;
  replyTo?: string;
}

/**
 * Create the campaign as a draft.
 *
 * Deliberately two steps — create, then send — rather than passing
 * `scheduledAt` for an immediate send. A draft that exists is recoverable: if
 * the send call fails, the admin sees the campaign in the history as a draft
 * and can retry it, instead of a half-made thing nobody can find. For a
 * genuinely scheduled campaign `scheduledAt` is passed at create time, which
 * is what Brevo wants, and no send call follows.
 */
export async function createCampaign(input: CreateCampaignInput): Promise<number> {
  const sender = await campaignSender();

  const body: Record<string, unknown> = {
    name: input.name.slice(0, 180),
    subject: input.subject.slice(0, 250),
    templateId: input.templateId,
    sender,
    recipients: { listIds: input.listIds },
    inlineImageActivation: false,
  };

  if (input.previewText) body.previewText = input.previewText.slice(0, 250);
  if (input.replyTo) body.replyTo = input.replyTo;
  if (input.scheduledAt) body.scheduledAt = input.scheduledAt;

  const created = await brevoPost<{ id: number }>("/emailCampaigns", body);
  clearBrevoCache();
  return created.id;
}

/** Send a draft now. Brevo answers 204. */
export async function sendCampaignNow(campaignId: number): Promise<void> {
  await brevoPost(`/emailCampaigns/${campaignId}/sendNow`, {});
  clearBrevoCache();
}

/**
 * Send a test copy.
 *
 * `emailTo` is accepted but is not in every version of the documented schema,
 * so a rejection falls back to the campaign's own test list — in which case
 * the caller tells the admin to set that list up in Brevo rather than
 * pretending the test went out.
 */
export async function sendCampaignTest(campaignId: number, emailTo: string[]): Promise<void> {
  await brevoPost(`/emailCampaigns/${campaignId}/sendTest`, { emailTo });
}

/** Cancel a scheduled campaign that hasn't gone out. */
export async function suspendCampaign(campaignId: number): Promise<void> {
  await brevoPut(`/emailCampaigns/${campaignId}/status`, { status: "suspended" });
  clearBrevoCache();
}

/* --------------------------------------------------- double-click guard */

/**
 * Stop the same submission creating two campaigns.
 *
 * A campaign cannot be unsent, so a double-click is the one mistake in this
 * screen that costs real money and real goodwill. The key is a hash of what
 * was submitted — template, subject, recipients — and it is claimed in the
 * store document *before* Brevo is called. A repeat within the hour is
 * answered with the campaign that already exists.
 *
 * Last-write-wins on the store document, as everywhere else here, so two
 * submissions in the same instant could still both get through. That is the
 * same window the promo-code redemption limit has, and the confirmation
 * dialog in front of it makes it a narrow one.
 */
const SEND_KEY_TTL_MS = 60 * 60 * 1000;

export function sendKey(parts: {
  templateId: number;
  subject: string;
  recipients: readonly string[];
  scheduledAt?: string | null;
}): string {
  const payload = [
    parts.templateId,
    parts.subject.trim().toLowerCase(),
    parts.scheduledAt ?? "now",
    [...parts.recipients].sort().join(","),
  ].join("|");

  // A short non-cryptographic digest: this only needs to tell two different
  // submissions apart, not resist anybody.
  let hash = 0;
  for (let i = 0; i < payload.length; i += 1) {
    hash = (hash * 31 + payload.charCodeAt(i)) | 0;
  }
  return `${parts.templateId}-${(hash >>> 0).toString(36)}-${parts.recipients.length}`;
}

/** The campaign id a matching submission already created, if there is one. */
export async function alreadySent(key: string): Promise<number | null> {
  const settings = await supabaseStore.read();
  if (!settings.lastSendKey || !settings.lastSendAt) return null;
  if (Date.now() - Date.parse(settings.lastSendAt) > SEND_KEY_TTL_MS) return null;

  const [storedKey, campaignId] = settings.lastSendKey.split(":");
  if (storedKey !== key) return null;
  const id = Number(campaignId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

export async function rememberSend(key: string, campaignId: number): Promise<void> {
  await supabaseStore.update({
    lastSendKey: `${key}:${campaignId}`,
    lastSendAt: new Date().toISOString(),
  });
}

/* ------------------------------------------------------------- reporting */

/** Everything the dashboard tiles add up, across the campaigns it was given. */
export function totalStats(campaigns: Campaign[]): CampaignStats {
  const total = { ...NO_STATS };
  for (const campaign of campaigns) {
    const stats = statsOf(campaign);
    for (const field of Object.keys(total) as (keyof CampaignStats)[]) {
      const value = stats[field];
      if (value === null) continue;
      total[field] = (total[field] ?? 0) + value;
    }
  }
  return total;
}

/** "sent" and "archive" are the two Brevo uses for a campaign that went out. */
export function hasGoneOut(campaign: Campaign): boolean {
  return campaign.status === "sent" || campaign.status === "archive";
}

export function isScheduled(campaign: Campaign): boolean {
  return (
    Boolean(campaign.scheduledAt) &&
    (campaign.status === "queued" || campaign.status === "in_process")
  );
}

/** A percentage of delivered, or null when there is nothing to divide by. */
export function rate(part: number | null, whole: number | null): number | null {
  if (part === null || whole === null || whole <= 0) return null;
  return Math.round((part / whole) * 1000) / 10;
}

export async function brevoListIdForSubscribers(): Promise<number | null> {
  const settings = await supabaseStore.read();
  return settings.listId ?? null;
}
