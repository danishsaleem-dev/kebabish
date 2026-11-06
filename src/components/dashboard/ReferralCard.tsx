"use client";

import { useState } from "react";
import { Check, Copy, MessageCircle, Users } from "lucide-react";
import type { ReferralTrack } from "@/lib/referrals";

export type ReferralLabels = {
  title: string;
  /** "They get €5 off… You get 1,000 points…", already filled in. */
  text: string;
  linkLabel: string;
  copy: string;
  copied: string;
  codeLabel: string;
  share: string;
  onTheWay: string;
  ordered: string;
  pointsEarned: string;
  /** Contains `{number}`, e.g. "Vriend {number}". */
  friendTemplate: string;
  status: Record<ReferralTrack["status"], string>;
};

const TONES: Record<ReferralTrack["status"], string> = {
  pending: "bg-warn-soft text-warn",
  rewarded: "bg-success-soft text-success",
  capped: "bg-canvas text-muted",
  cancelled: "bg-canvas text-muted",
};

/**
 * The customer's own invite link, ready to share, and how it is doing.
 * Counts and dates only — never who ordered, which is deliberate: staff can
 * see the friend's name in /admin, the customer cannot.
 */
export default function ReferralCard({
  link,
  code,
  shareText,
  pending,
  rewarded,
  pointsEarned,
  tracks,
  dates,
  labels,
}: {
  link: string;
  code: string;
  shareText: string;
  pending: number;
  rewarded: number;
  /** Formatted total. */
  pointsEarned: string;
  tracks: ReferralTrack[];
  /** Each track's date, formatted on the server, in the same order. */
  dates: string[];
  labels: ReferralLabels;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // The clipboard can be refused; the link stays on screen to select by hand.
    }
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-hairline bg-panel shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
      <div className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
            <Users size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-base font-semibold text-heading">{labels.title}</h2>
            <p className="mt-0.5 text-sm text-muted">{labels.text}</p>
          </div>
        </div>

        <p className="mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
          {labels.linkLabel}
        </p>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-hairline bg-canvas px-3 py-2.5">
          <span className="min-w-0 flex-1 select-all truncate text-sm font-medium text-heading">
            {link}
          </span>
          <button
            type="button"
            onClick={copy}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-semibold text-ember-700 transition-colors hover:bg-ember-600/10"
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? labels.copied : labels.copy}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">
          {labels.codeLabel}: <span className="font-semibold text-heading">{code}</span>
        </p>

        <a
          href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
        >
          <MessageCircle size={16} aria-hidden="true" />
          {labels.share}
        </a>
      </div>

      {(pending > 0 || rewarded > 0) && (
        <dl className="grid grid-cols-3 divide-x divide-hairline border-t border-hairline bg-canvas/60 text-center">
          <Stat label={labels.onTheWay} value={String(pending)} />
          <Stat label={labels.ordered} value={String(rewarded)} />
          <Stat label={labels.pointsEarned} value={pointsEarned} />
        </dl>
      )}

      {tracks.length > 0 && (
        <ul className="divide-y divide-hairline border-t border-hairline">
          {tracks.map((track, i) => (
            <li
              key={track.id}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-5 py-3 text-sm sm:px-6"
            >
              <span className="min-w-0 text-body-text">
                {labels.friendTemplate.replace("{number}", String(tracks.length - i))}
                <span className="ml-2 text-xs text-faint">{dates[i]}</span>
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${TONES[track.status]}`}
              >
                {labels.status[track.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-2 py-4">
      <dd className="font-display text-xl font-semibold tabular-nums text-heading">{value}</dd>
      <dt className="mt-0.5 text-xs text-muted">{label}</dt>
    </div>
  );
}
