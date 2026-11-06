import Link from "next/link";
import { DatabaseZap, PlugZap } from "lucide-react";
import Card from "@/components/admin/ui/Card";

/**
 * The two things that have to be in place before this section does anything,
 * and the card that says which one is missing.
 *
 * Same shape as the "Rewards aren't set up yet" card: the feature degrades to
 * an explanation rather than an error, and the rest of the site is unaffected
 * either way.
 */

export function MigrationMissing() {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
        <DatabaseZap size={22} />
      </span>
      <h2 className="font-display text-lg font-semibold text-heading">
        Email marketing isn&apos;t set up yet
      </h2>
      <p className="max-w-md text-sm text-muted">
        Run{" "}
        <code className="rounded bg-hairline px-1">
          supabase/migrations/0032_marketing_contacts.sql
        </code>{" "}
        once in the Supabase SQL editor. Until then no campaign can be sent — there is nowhere
        to record who unsubscribed, and sending without that would mean emailing people who had
        opted out. The website works exactly as before.
      </p>
    </Card>
  );
}

export function NotConnected() {
  return (
    <Card className="flex flex-col items-center gap-3 py-10 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
        <PlugZap size={22} />
      </span>
      <h2 className="font-display text-lg font-semibold text-heading">Brevo isn&apos;t connected</h2>
      <p className="max-w-md text-sm text-muted">
        Set <code className="rounded bg-hairline px-1">BREVO_API_KEY</code> in the environment
        variables, then press Connect on the settings page. Transactional email — receipts,
        password resets, order updates — goes through Resend and is not affected by this.
      </p>
      <Link
        href="/admin/marketing/email/settings"
        className="rounded-lg bg-ember-600 px-4 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-ember-500"
      >
        Open settings
      </Link>
    </Card>
  );
}

/** A Brevo read failed for some other reason — say which, don't hide it. */
export function BrevoProblem({ message }: { message: string }) {
  return (
    <Card className="border-danger/40">
      <h2 className="font-display text-base font-semibold text-heading">
        Brevo couldn&apos;t be read
      </h2>
      <p className="mt-1 text-sm text-muted">{message}</p>
    </Card>
  );
}
