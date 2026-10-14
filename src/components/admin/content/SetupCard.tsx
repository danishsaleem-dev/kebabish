import { DatabaseZap } from "lucide-react";
import Card from "@/components/admin/ui/Card";

/** Shown instead of an editor until migration 0019 has been run. */
export default function SetupCard() {
  return (
    <Card className="mx-auto flex max-w-xl flex-col items-center gap-3 py-12 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-warn-soft text-warn">
        <DatabaseZap size={22} />
      </span>
      <h2 className="font-display text-lg font-semibold text-heading">
        Website editing isn&apos;t set up yet
      </h2>
      <p className="max-w-md text-sm text-muted">
        Run <code className="rounded bg-hairline px-1">supabase/migrations/0019_site_content.sql</code> once in the
        Supabase SQL editor. Until then the website simply keeps showing its built-in text, and nothing here can be
        saved.
      </p>
    </Card>
  );
}
