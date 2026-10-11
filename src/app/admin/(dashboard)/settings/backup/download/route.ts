import { auth } from "@/lib/auth";
import { updateSettings } from "@/lib/admin/store";
import { buildBackup, totalRows } from "@/lib/backup/export";

export const dynamic = "force-dynamic";
// A full export reads a dozen tables; give it room on a cold function.
export const maxDuration = 60;

/**
 * Download a full backup as one JSON file.
 *
 * A route handler, so the admin layout's guard does not cover it — the role is
 * checked here, by hand. **Owner only**: the file holds every customer's name,
 * address, phone number and email, which staff do not need in a file they can
 * copy off the premises. A plain 404-ish 401 for anyone else, with no hint of
 * what lives here.
 *
 * It is a GET that records "last backup" (so the dashboard can say when one is
 * overdue). That is safe: a cross-site GET can't read the response, and the
 * worst a forged request could do is stamp the date.
 */
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "owner") {
    return new Response("Unauthorized", { status: 401 });
  }

  let backup;
  try {
    backup = await buildBackup(session.user.email ?? null);
  } catch (error) {
    console.error("[backup] export failed:", error);
    return new Response("The backup could not be created. Nothing was changed — try again.", {
      status: 500,
    });
  }

  // Record it only once the file is built: "last backup" must mean a backup
  // that actually exists. A failure to record never costs the owner the file.
  try {
    await updateSettings({
      lastBackupAt: backup.exportedAt,
      lastBackupRows: totalRows(backup.counts),
    });
  } catch (error) {
    console.error("[backup] could not record the backup time:", error);
  }

  // Amsterdam's date and time in the filename, so it sorts and reads naturally.
  const stamp = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(backup.exportedAt))
    .replace(" ", "-")
    .replace(":", "");

  return new Response(JSON.stringify(backup), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="kebabish-backup-${stamp}.json"`,
      // Personal data: never let a browser or a proxy keep a copy.
      "Cache-Control": "no-store",
    },
  });
}
