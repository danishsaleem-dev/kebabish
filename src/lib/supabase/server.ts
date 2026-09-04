import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — server-only, bypasses Row Level Security.
 *
 * This is deliberately NOT exported for use in Client Components or sent to
 * the browser; the service role key must never leave the server. Auth checks
 * (who's allowed to do what) happen in application code (NextAuth sessions,
 * role checks in server actions), not in RLS policies, since every query
 * here runs as an unrestricted superuser against the database.
 *
 * Created lazily rather than at module scope so a missing env var only
 * breaks the specific request that needed Supabase, not the whole build.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Supabase isn't configured — set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env"
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
