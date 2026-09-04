import { Construction } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card from "@/components/admin/ui/Card";

/**
 * Stub screen for nav destinations that exist so nothing 404s while the
 * dashboard UI is being built out. Each of these gets a real screen as the
 * corresponding backend feature lands.
 */
export default function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <AdminShell title={title}>
      <Card className="flex min-h-[420px] flex-col items-center justify-center text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ember-600/10 text-ember-600">
          <Construction size={26} />
        </span>
        <h2 className="mt-5 font-display text-xl font-semibold text-heading">
          {title}
        </h2>
        <p className="mt-2 max-w-md text-sm leading-relaxed text-muted">
          {description}
        </p>
        <p className="mt-6 rounded-full border border-hairline px-3 py-1.5 text-xs font-medium text-faint">
          Screen not built yet
        </p>
      </Card>
    </AdminShell>
  );
}
