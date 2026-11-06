import "server-only";

/**
 * Minimal Brevo REST client.
 *
 * A thin `fetch` wrapper rather than the `@getbrevo/brevo` SDK, for the same
 * reason `src/lib/mollie.ts` is one: we call a dozen endpoints, the SDK is a
 * generated wrapper over the same JSON, and "avoid unnecessary dependencies"
 * is explicit in the brief.
 *
 * Two things this file exists to handle.
 *
 * **Rate limits.** Brevo's limits are lowest on exactly the endpoints the
 * admin screens read most. Campaign endpoints fall under "all other
 * endpoints" at 100 requests per hour; `/v3/smtp/*` — which includes the
 * template list — is 300 per hour. Contacts are generous (10/s). So every GET
 * that an admin page makes on render goes through `cachedGet`, and a 429 is
 * retried with backoff rather than surfaced as a broken page.
 *
 * **Not being configured is normal.** Before Danish pastes an API key, every
 * read has to come back "not connected" instead of throwing — the same rule
 * the store, the feedback tables and the stock tables follow.
 */

const API = "https://api.brevo.com/v3";

/** How long a cached GET stays fresh. Short enough to feel live, long enough to stay inside 100/hour. */
const CACHE_MS = 60_000;
/** A failed GET is cached briefly too, so a dead API isn't hammered once a page is reloaded. */
const FAILURE_CACHE_MS = 10_000;

export class BrevoError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "BrevoError";
    this.status = status;
    this.code = code;
  }
}

/** Thrown by nothing — callers check `isBrevoConfigured()` first. */
export function isBrevoConfigured(): boolean {
  return Boolean(process.env.BREVO_API_KEY?.trim());
}

function apiKey(): string {
  const key = process.env.BREVO_API_KEY?.trim();
  if (!key) throw new BrevoError(0, "not-configured", "BREVO_API_KEY isn't set.");
  return key;
}

/**
 * One request, with a retry on 429 and on a 5xx.
 *
 * Brevo documents that it returns rate-limit headers but not which ones, so
 * the backoff is a plain doubling delay rather than something that trusts a
 * header to exist. Three attempts: a campaign send is not worth giving up on
 * because Brevo was busy for a second, and it is not worth hanging a request
 * for a minute either.
 */
async function request<T>(
  path: string,
  init: RequestInit & { attempt?: number } = {}
): Promise<T> {
  const { attempt = 1, ...rest } = init;

  const response = await fetch(`${API}${path}`, {
    ...rest,
    headers: {
      "api-key": apiKey(),
      accept: "application/json",
      ...(rest.body ? { "content-type": "application/json" } : {}),
      ...rest.headers,
    },
    cache: "no-store",
  });

  // 204 is Brevo's success for sendNow, sendTest and most deletes.
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  const body: unknown = text ? safeJson(text) : null;

  if (response.ok) return (body ?? undefined) as T;

  const retryable = response.status === 429 || response.status >= 500;
  if (retryable && attempt < 3) {
    await sleep(attempt * 1200);
    return request<T>(path, { ...init, attempt: attempt + 1 });
  }

  const detail = asErrorBody(body);
  throw new BrevoError(
    response.status,
    detail.code,
    `Brevo ${response.status}${detail.code ? ` ${detail.code}` : ""}: ${
      detail.message ?? response.statusText
    }`
  );
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return { message: text.slice(0, 300) };
  }
}

function asErrorBody(body: unknown): { code?: string; message?: string } {
  if (!body || typeof body !== "object") return {};
  const record = body as Record<string, unknown>;
  return {
    code: typeof record.code === "string" ? record.code : undefined,
    message: typeof record.message === "string" ? record.message : undefined,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function brevoGet<T>(path: string): Promise<T> {
  return request<T>(path, { method: "GET" });
}

export function brevoPost<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "POST", body: JSON.stringify(body) });
}

export function brevoPut<T>(path: string, body: unknown): Promise<T> {
  return request<T>(path, { method: "PUT", body: JSON.stringify(body) });
}

export function brevoDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE" });
}

/* ------------------------------------------------------------------ cache */

type CacheEntry = { at: number; value: unknown; failed: boolean };
const cache = new Map<string, CacheEntry>();

/**
 * A GET whose answer is reused for a minute.
 *
 * Per server instance and in memory, like every other cache in this codebase
 * (`bestsellers.ts`, `getContent()`, the postcode distance cache). Two admins
 * on two instances may each spend one request; that is well inside 100/hour.
 */
export async function cachedGet<T>(path: string): Promise<T> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < (hit.failed ? FAILURE_CACHE_MS : CACHE_MS)) {
    if (hit.failed) throw hit.value;
    return hit.value as T;
  }

  try {
    const value = await brevoGet<T>(path);
    cache.set(path, { at: Date.now(), value, failed: false });
    if (cache.size > 200) pruneCache();
    return value;
  } catch (error) {
    cache.set(path, { at: Date.now(), value: error, failed: true });
    throw error;
  }
}

/**
 * Drop everything cached. Called after any write that changes what a GET
 * would say — creating a campaign, sending one, syncing contacts — so the
 * screen the admin lands on afterwards shows the new state rather than a
 * minute-old one.
 */
export function clearBrevoCache(): void {
  cache.clear();
}

function pruneCache(): void {
  const cutoff = Date.now() - CACHE_MS;
  for (const [key, entry] of cache) {
    if (entry.at < cutoff) cache.delete(key);
  }
}

/* ------------------------------------------------------------- connection */

export interface BrevoAccount {
  companyName: string;
  email: string;
  plan: { type: string; creditsType?: string; credits?: number }[];
}

/**
 * Who the key belongs to — the admin's "connected" indicator, and the one
 * call that proves the key works. Cached like any other GET.
 */
export function getBrevoAccount(): Promise<BrevoAccount> {
  return cachedGet<BrevoAccount>("/account");
}

/** The one-line reason a Brevo read failed, for a card in the admin. */
export function brevoProblem(error: unknown): string {
  if (error instanceof BrevoError) {
    if (error.code === "not-configured") return "No Brevo API key is set.";
    if (error.status === 401) return "Brevo rejected the API key.";
    if (error.status === 429) return "Brevo's rate limit was reached — try again in a minute.";
    return error.message;
  }
  return "Brevo could not be reached.";
}
