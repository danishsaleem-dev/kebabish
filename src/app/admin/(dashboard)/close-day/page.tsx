import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";
import { DatabaseZap } from "lucide-react";
import CloseDayPanel from "@/components/admin/CloseDayPanel";
import { loadCloseDayState } from "@/lib/admin/close-day";
import { isOwner } from "@/lib/admin/guard";

export const metadata = { title: "Close the day" };
export const dynamic = "force-dynamic";

/**
 * Close the day by hand: a checklist that has to be clear, the day's figures to count the cash
 * against, an "Audit done" tick, and the history of closed days. See `business-day.ts` for what
 * a business day is and how it is labelled.
 */
export default async function CloseDayPage() {
  const [state, owner] = await Promise.all([loadCloseDayState(), isOwner()]);

  if (!state.ready) {
    return (
      <AdminShell title="Close the day">
        <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
            <DatabaseZap size={22} />
          </span>
          <h2 className="font-display text-lg font-semibold text-heading">
            Closing the day isn&apos;t set up yet
          </h2>
          <p className="max-w-md text-sm text-muted">
            Run <code className="rounded bg-hairline px-1">supabase/migrations/0027_business_days.sql</code>{" "}
            once in the Supabase SQL editor. Until then reports use calendar days, as before.
          </p>
        </Card>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Close the day">
      <CloseDayPanel
        open={state.open}
        items={state.items}
        summary={state.summary}
        laterScheduled={state.laterScheduled}
        now={state.now}
        history={[...state.days].reverse().slice(0, 30)}
        canReopen={owner}
      />
    </AdminShell>
  );
}
