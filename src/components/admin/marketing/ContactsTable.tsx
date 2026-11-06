"use client";

import { useMemo, useState } from "react";
import { Input, Select } from "@/components/admin/ui/Form";

export interface ContactRow {
  email: string;
  name: string;
  kind: "registered" | "guest";
  orderCount: number;
  language: string;
  consentAt: string;
  syncedAt: string | null;
}

export interface SuppressedRow {
  email: string;
  reason: string;
  at: string;
}

const REASON_LABEL: Record<string, string> = {
  unsubscribe: "Unsubscribed",
  hard_bounce: "Address doesn't exist",
  soft_bounce: "Delivery kept failing",
  spam: "Marked as spam",
  manual: "Stopped by hand",
  contact_deleted: "Deleted in Brevo",
};

/**
 * Who may be emailed, and who may not.
 *
 * Deliberately two tables rather than one with a status column: they answer
 * different questions. The first is the audience; the second is the record of
 * people who are out of it for good, which is the list an admin wants when
 * somebody rings up asking why they stopped getting emails.
 *
 * There is **no control here to add somebody to the audience, or to put a
 * suppressed address back.** That is the point. Consent is given on the
 * website by the customer; a re-subscribe has to happen in Brevo, by them.
 */
export default function ContactsTable({
  contacts,
  suppressed,
}: {
  contacts: ContactRow[];
  suppressed: SuppressedRow[];
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState<"all" | "registered" | "guest">("all");

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return contacts.filter((contact) => {
      if (kind !== "all" && contact.kind !== kind) return false;
      if (!needle) return true;
      return (
        contact.email.includes(needle) || contact.name.toLowerCase().includes(needle)
      );
    });
  }, [contacts, kind, search]);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="rounded-2xl border border-hairline bg-panel shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex flex-wrap items-center gap-3 p-5 sm:p-6">
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-lg font-semibold text-heading">
              Can be emailed
            </h2>
            <p className="mt-1 text-sm text-muted">
              Everyone who ticked the marketing box and hasn&apos;t unsubscribed. Nothing on this
              screen can add somebody — only the customer can, on the website.
            </p>
          </div>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search name or email"
            className="max-w-[14rem]"
          />
          <Select
            value={kind}
            onChange={(event) => setKind(event.target.value as typeof kind)}
            className="max-w-[11rem]"
          >
            <option value="all">Everyone</option>
            <option value="registered">With an account</option>
            <option value="guest">Guests</option>
          </Select>
        </div>

        <div className="overflow-x-auto border-t border-hairline">
          {rows.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted">
              {contacts.length === 0
                ? "Nobody has opted in to marketing email yet. The box is on the sign-up form, at checkout and on the customer's own account page — and it is never ticked for them."
                : "Nobody matches that."}
            </p>
          ) : (
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-semibold text-faint">
                  <th className="px-5 py-3">Customer</th>
                  <th className="px-5 py-3">Type</th>
                  <th className="px-5 py-3 text-right">Orders</th>
                  <th className="px-5 py-3">Language</th>
                  <th className="px-5 py-3">Opted in</th>
                  <th className="px-5 py-3">Synced to Brevo</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((contact) => (
                  <tr key={contact.email} className="border-b border-hairline last:border-0">
                    <td className="max-w-[18rem] px-5 py-3">
                      <span className="block truncate font-medium text-heading">
                        {contact.name || contact.email}
                      </span>
                      <span className="block truncate text-xs text-faint">{contact.email}</span>
                    </td>
                    <td className="px-5 py-3">
                      <span className="rounded-md bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
                        {contact.kind === "registered" ? "Account" : "Guest"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right text-muted">{contact.orderCount}</td>
                    <td className="px-5 py-3 uppercase text-muted">{contact.language}</td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{contact.consentAt}</td>
                    <td className="whitespace-nowrap px-5 py-3">
                      {contact.syncedAt ? (
                        <span className="text-muted">{contact.syncedAt}</span>
                      ) : (
                        <span className="text-warn">Not yet</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-hairline bg-panel shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="p-5 sm:p-6">
          <h2 className="font-display text-lg font-semibold text-heading">
            Will never be emailed again
          </h2>
          <p className="mt-1 text-sm text-muted">
            People who unsubscribed, bounced or reported a campaign as spam. They are excluded
            from every campaign, including one sent to a hand-picked list — there is no way to
            send to them from this panel at all.
          </p>
        </div>

        {suppressed.length === 0 ? (
          <p className="border-t border-hairline p-8 text-center text-sm text-muted">
            Nobody. Good sign.
          </p>
        ) : (
          <div className="overflow-x-auto border-t border-hairline">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-hairline text-left text-xs font-semibold text-faint">
                  <th className="px-5 py-3">Email</th>
                  <th className="px-5 py-3">Why</th>
                  <th className="px-5 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {suppressed.map((row) => (
                  <tr key={row.email} className="border-b border-hairline last:border-0">
                    <td className="max-w-[18rem] truncate px-5 py-3 text-heading">{row.email}</td>
                    <td className="px-5 py-3 text-muted">
                      {REASON_LABEL[row.reason] ?? row.reason}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3 text-muted">{row.at}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
