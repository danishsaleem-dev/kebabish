/**
 * How fresh the last backup is. Pure and import-free, so both the backup page
 * and the dashboard reminder (and anything client-side) can use it.
 *
 * "Overdue" is more than a week: the owner downloads weekly, so a week and a day
 * with nothing means it was missed, and that is when to say so — a reminder that
 * fires every day teaches people to ignore it.
 */
export const BACKUP_OVERDUE_DAYS = 7;

export interface BackupStatus {
  /** Whole days since the last backup, or null if there has never been one. */
  daysAgo: number | null;
  overdue: boolean;
}

export function backupStatus(lastBackupAt: string | undefined, now: number = Date.now()): BackupStatus {
  if (!lastBackupAt) return { daysAgo: null, overdue: true };
  const age = now - Date.parse(lastBackupAt);
  if (Number.isNaN(age)) return { daysAgo: null, overdue: true };
  const daysAgo = Math.max(0, Math.floor(age / 86_400_000));
  return { daysAgo, overdue: daysAgo > BACKUP_OVERDUE_DAYS };
}
