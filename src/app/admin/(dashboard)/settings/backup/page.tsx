import { AlertTriangle, CheckCircle2, Download, FileLock2, ShieldAlert } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { requireRole } from "@/lib/admin/guard";
import { getSettings } from "@/lib/admin/store";
import { backupStatus, BACKUP_OVERDUE_DAYS } from "@/lib/backup/status";

export const metadata = { title: "Backup" };
export const dynamic = "force-dynamic";

/**
 * Owner-only (the page redirects anyone else, and the download route checks the
 * role itself). The file it hands out contains every customer's personal data,
 * which is exactly why staff don't get it.
 */
export default async function BackupPage() {
  await requireRole(["owner"]);
  const settings = await getSettings();
  const status = backupStatus(settings.lastBackupAt);

  const when = settings.lastBackupAt
    ? new Date(settings.lastBackupAt).toLocaleString("en-GB", {
        timeZone: "Europe/Amsterdam",
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <AdminShell title="Backup">
      <div className="mx-auto max-w-3xl space-y-4 sm:space-y-6">
        <Card>
          <div className="flex flex-wrap items-center justify-between gap-5">
            <div className="flex items-start gap-3">
              <span
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${
                  status.overdue ? "bg-warn-soft text-warn" : "bg-success-soft text-success"
                }`}
              >
                {status.overdue ? <AlertTriangle size={22} /> : <CheckCircle2 size={22} />}
              </span>
              <div>
                <h2 className="font-display text-lg font-semibold text-heading">
                  {when ? "Last backup" : "No backup yet"}
                </h2>
                {when ? (
                  <p className="mt-0.5 text-sm text-muted">
                    {when} ·{" "}
                    {status.daysAgo === 0
                      ? "today"
                      : `${status.daysAgo} day${status.daysAgo === 1 ? "" : "s"} ago`}
                    {settings.lastBackupRows != null && ` · ${settings.lastBackupRows.toLocaleString("en-GB")} records`}
                  </p>
                ) : (
                  <p className="mt-0.5 text-sm text-muted">
                    Nothing has been downloaded yet. Do one now, then once a week.
                  </p>
                )}
                {status.overdue && when && (
                  <p className="mt-1 text-sm font-medium text-warn">
                    More than {BACKUP_OVERDUE_DAYS} days — time for a new one.
                  </p>
                )}
              </div>
            </div>

            {/* A plain link on purpose: this is a file download from a route handler,
                and next/link would try to client-navigate to it instead. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a
              href="/admin/settings/backup/download"
              className="inline-flex items-center gap-2 rounded-lg bg-ember-600 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-ember-500"
            >
              <Download size={16} />
              Download backup
            </a>
          </div>
        </Card>

        <Card>
          <CardHeader
            title="Every week"
            subtitle="This is the free substitute for real database backups, so it only works if it is done."
          />
          <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-body-text">
            <li>Press <strong>Download backup</strong>. It takes a few seconds and saves one file.</li>
            <li>
              Move it somewhere <strong>private and separate from this computer</strong> — an encrypted drive or a
              private cloud folder. Not email, not WhatsApp.
            </li>
            <li>Keep the last four or so, and delete older ones.</li>
          </ol>
        </Card>

        <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
          <Card>
            <CardHeader title="What's in it" />
            <ul className="mt-3 space-y-1.5 text-sm text-body-text">
              <li>Orders, order lines and refunds (with invoice and credit-note numbers)</li>
              <li>Customers and staff accounts</li>
              <li>The menu, prices, extras, recipes, allergens and all settings</li>
              <li>Feedback and delivery-slot bookings</li>
            </ul>
          </Card>
          <Card>
            <CardHeader title="What isn't" />
            <ul className="mt-3 space-y-1.5 text-sm text-body-text">
              <li>
                <strong>Passwords</strong> — deliberately left out, so a lost file can&apos;t leak them. After a
                restore, everyone uses &ldquo;forgot password&rdquo;.
              </li>
              <li>
                <strong>Photos and videos</strong> — only their records are saved, not the images. Keep your
                originals.
              </li>
              <li>API keys and secrets (they live in Vercel, not the database)</li>
            </ul>
          </Card>
        </div>

        <Card className="border-warn/30 bg-warn-soft/40">
          <div className="flex items-start gap-3">
            <FileLock2 size={18} className="mt-0.5 shrink-0 text-warn" />
            <div className="min-w-0">
              <h3 className="font-display text-base font-semibold text-heading">
                The file contains personal data
              </h3>
              <p className="mt-1 text-sm text-body-text">
                Customer names, addresses, phone numbers and emails are in it, so under the GDPR it has to be
                stored carefully and old copies deleted. That is why only the owner can download it.
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start gap-3">
            <ShieldAlert size={18} className="mt-0.5 shrink-0 text-faint" />
            <div className="min-w-0 text-sm text-body-text">
              <h3 className="font-display text-base font-semibold text-heading">
                Honest limits, and what to do about them
              </h3>
              <p className="mt-1">
                A weekly file means that if the database were lost, you could lose up to a week of orders. Once
                real orders are coming in daily, upgrade the Supabase project to the <strong>Pro plan</strong>
                (about $25 a month) for automatic daily backups — keep this download as well, as a second copy
                that lives outside Supabase.
              </p>
              <p className="mt-2">
                To restore, ask your developer to run <code className="rounded bg-hairline px-1">node scripts/restore-backup.mjs</code>{" "}
                with this file; it checks everything first and changes nothing unless told to.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminShell>
  );
}
