"use server";

import { headers } from "next/headers";
import { after } from "next/server";
import { z } from "zod";
import { createResetTokenForEmail } from "@/lib/password-reset";
import { sendPasswordResetEmail } from "@/lib/email/password-reset";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const emailSchema = z.string().trim().email("That doesn't look like an email address.");

/**
 * Per-instance throttle: at most one reset email per address a minute, so
 * the form can't be used to flood somebody's inbox. In memory only (no
 * table for it), which means it is per server instance, not global — good
 * enough to blunt casual abuse; Resend's own rate limits are the backstop.
 */
const lastSent = new Map<string, number>();
const THROTTLE_MS = 60_000;

/** The origin this request came in on, so the link points back at the same site. */
async function requestOrigin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host");
  if (!host) return (process.env.NEXT_PUBLIC_SITE_URL ?? "").replace(/\/$/, "");
  const proto =
    list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Always answers the same thing whether or not an account exists for that
 * address — otherwise this form would be a way to find out who has one.
 */
export async function requestPasswordResetAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { ok: false, errors: { email: parsed.error.issues[0].message } };
  }
  const email = parsed.data;
  const key = email.toLowerCase();

  const generic: FormState = {
    ok: true,
    message:
      "If there's an account for that address, we've emailed you a link to choose a new password. It works for 60 minutes.",
  };

  const previous = lastSent.get(key) ?? 0;
  if (Date.now() - previous < THROTTLE_MS) return generic;
  lastSent.set(key, Date.now());

  try {
    const found = await createResetTokenForEmail(email);
    if (found) {
      const resetUrl = `${await requestOrigin()}/reset-password?token=${encodeURIComponent(found.token)}`;
      after(() =>
        sendPasswordResetEmail({
          to: found.account.email,
          name: found.account.name,
          resetUrl,
        })
      );
    }
  } catch (error) {
    // Don't tell the visitor either way — just record it.
    console.error("[password-reset] could not start a reset:", error);
  }

  return generic;
}
