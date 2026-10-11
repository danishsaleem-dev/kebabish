import Link from "next/link";
import { DatabaseBackup } from "lucide-react";
import { backupStatus } from "@/lib/backup/status";

/**
 * A single line on the owner's dashboard when the weekly backup has been
 * missed. It is only shown to the owner, only once there is a paid order worth
 * protecting (before launch there is nothing to lose and the banner would just
 * be noise), and only when overdue — a banner that is always there gets ignored.
 */
export default function BackupReminder({
  lastBackupAt,
  hasPaidOrders,
}: {
  lastBackupAt: string | undefined;
  hasPaidOrders: boolean;
}) {
  if (!hasPaidOrders) return null;
  const status = backupStatus(lastBackupAt);
  if (!status.overdue) return null;

  return (
    <Link
      href="/admin/settings/backup"
      className="mb-4 flex items-center gap-3 rounded-xl bg-warn-soft px-4 py-3 text-sm font-medium text-warn transition-opacity hover:opacity-90 sm:mb-6"
    >
      <DatabaseBackup size={18} className="shrink-0" />
      <span>
        {status.daysAgo === null
          ? "You haven't downloaded a backup yet."
          : `Your last backup is ${status.daysAgo} days old.`}{" "}
        <span className="underline underline-offset-2">Download one now</span>
      </span>
    </Link>
  );
}
