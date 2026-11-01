"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, MessageCircle, Users } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import type { ReferralTrack } from "@/lib/referrals";

const STATUS: Record<ReferralTrack["status"], { label: string; tone: string }> = {
  pending: { label: "Order on its way, points follow after delivery", tone: "bg-warn-soft text-warn" },
  rewarded: { label: "Delivered, points added", tone: "bg-success-soft text-success" },
  capped: { label: "Delivered, past this month's limit", tone: "bg-canvas text-muted" },
  cancelled: { label: "Order cancelled, no points", tone: "bg-canvas text-muted" },
};

/** The customer's own link, ready to share, and how it is doing. Counts only, never names. */
export default function ReferralCard({
  link,
  code,
  friendAmount,
  rewardPoints,
  shareText,
  pending,
  rewarded,
  pointsEarned,
  tracks,
}: {
  link: string;
  code: string;
  friendAmount: string;
  rewardPoints: string;
  shareText: string;
  pending: number;
  rewarded: number;
  pointsEarned: string;
  tracks: ReferralTrack[];
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
    <Card>
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
          <Users size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold text-heading">Invite a friend</h2>
          <p className="mt-0.5 text-sm text-muted">
            They get {friendAmount} off their first order. You get {rewardPoints} points once it&apos;s delivered.{" "}
            <Link href="/en/referral" className="font-semibold text-ember-700 underline underline-offset-2">
              How it works
            </Link>
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-heading select-all">{link}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-xs font-semibold text-ember-700 transition-colors hover:bg-ember-600/10"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-muted">
        Your code: <span className="font-semibold text-heading">{code}</span>
      </p>

      <a
        href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-[#25D366] px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
      >
        <MessageCircle size={16} />
        Share on WhatsApp
      </a>

      {(pending > 0 || rewarded > 0) && (
        <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-hairline pt-4 text-center">
          <Stat label="On the way" value={String(pending)} />
          <Stat label="Friends ordered" value={String(rewarded)} />
          <Stat label="Points earned" value={pointsEarned} />
        </dl>
      )}

      {tracks.length > 0 && (
        <ul className="mt-4 divide-y divide-hairline border-t border-hairline text-sm">
          {tracks.map((track, i) => (
            <li key={track.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2.5">
              <span className="min-w-0 text-body-text">
                Friend {tracks.length - i}
                <span className="ml-2 text-xs text-faint">
                  {new Date(track.createdAt).toLocaleDateString("en-GB", {
                    timeZone: "Europe/Amsterdam",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS[track.status].tone}`}>
                {STATUS[track.status].label}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dd className="font-display text-lg font-semibold tabular-nums text-heading">{value}</dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}
