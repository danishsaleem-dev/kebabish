"use client";

import { useActionState } from "react";
import { Check, KeyRound, Loader2, MailCheck, Send, UserCog } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import PasswordInput from "@/components/shared/PasswordInput";
import {
  changePasswordAction,
  resendSetupEmailAction,
  updateProfileAction,
} from "@/app/dashboard/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

/**
 * The account page's forms. Each posts a hidden `locale`, which is how the
 * server actions know which language to answer in — the dashboard sits
 * outside `[locale]`, so there is nothing in the URL to tell them (the same
 * trick the signup action uses).
 */

function Status({ state }: { state: FormState }) {
  if (!state.message) return null;
  return (
    <span
      role="status"
      className={`inline-flex items-center gap-1.5 text-sm ${state.ok ? "text-success" : "text-danger"}`}
    >
      {state.ok && <Check size={14} aria-hidden="true" />}
      {state.message}
    </span>
  );
}

/**
 * Shown while the account has no password yet (it was created when an order
 * was paid). Says what to do — open the email, choose a password — and
 * offers to send it again.
 */
export function ConfirmAccountBanner({
  locale,
  title,
  text,
  resend,
}: {
  locale: string;
  title: string;
  /** Already carries the email address. */
  text: string;
  resend: string;
}) {
  const [state, action, pending] = useActionState(resendSetupEmailAction, EMPTY);
  return (
    <Card className="border-ember-600/30 bg-ember-600/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
            <MailCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-heading">{title}</h2>
            <p className="mt-0.5 max-w-xl text-sm text-body-text">{text}</p>
            <div className="mt-2 min-h-5">
              <Status state={state} />
            </div>
          </div>
        </div>
        <form action={action}>
          <input type="hidden" name="locale" value={locale} />
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-xl border border-ember-600/40 bg-panel px-4 py-2.5 text-sm font-semibold text-ember-700 transition-colors hover:bg-ember-600/10 disabled:opacity-60"
          >
            {pending ? (
              <Loader2 size={15} className="animate-spin" aria-hidden="true" />
            ) : (
              <Send size={15} aria-hidden="true" />
            )}
            {resend}
          </button>
        </form>
      </div>
    </Card>
  );
}

export type ProfileLabels = {
  title: string;
  name: string;
  phone: string;
  phoneHint: string;
  email: string;
  emailHint: string;
  save: string;
};

/** Name and phone. The email address is the account itself, so it is shown, not edited. */
export function ProfileCard({
  locale,
  name,
  email,
  phone,
  labels,
}: {
  locale: string;
  name: string;
  email: string;
  phone: string;
  labels: ProfileLabels;
}) {
  const [state, action] = useActionState(updateProfileAction, EMPTY);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserCog size={18} className="text-ember-600" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-heading">{labels.title}</h2>
      </div>
      <form action={action} className="mt-4 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <FormError message={!state.ok && !state.errors ? state.message : undefined} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.name} error={state.errors?.name}>
            <Input name="name" defaultValue={name} autoComplete="name" required maxLength={80} />
          </Field>
          <Field label={labels.phone} hint={labels.phoneHint} error={state.errors?.phone}>
            <Input name="phone" type="tel" defaultValue={phone} autoComplete="tel" inputMode="tel" />
          </Field>
        </div>
        <Field label={labels.email} hint={labels.emailHint}>
          <Input value={email} readOnly disabled aria-readonly="true" />
        </Field>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>{labels.save}</SubmitButton>
          <Status state={state.ok ? state : { ok: false }} />
        </div>
      </form>
    </Card>
  );
}

export type PasswordLabels = {
  title: string;
  current: string;
  next: string;
  nextHint: string;
  repeat: string;
  save: string;
};

/** Change password, for an account that already has one. */
export function PasswordCard({
  locale,
  labels,
}: {
  locale: string;
  labels: PasswordLabels;
}) {
  const [state, action] = useActionState(changePasswordAction, EMPTY);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-ember-600" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-heading">{labels.title}</h2>
      </div>
      <form action={action} key={state.ok ? "done" : "form"} className="mt-4 space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <FormError message={!state.ok && !state.errors ? state.message : undefined} />
        <Field label={labels.current} error={state.errors?.current}>
          <PasswordInput name="current" autoComplete="current-password" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={labels.next} hint={labels.nextHint} error={state.errors?.password}>
            <PasswordInput name="password" autoComplete="new-password" required />
          </Field>
          <Field label={labels.repeat} error={state.errors?.confirm}>
            <PasswordInput name="confirm" autoComplete="new-password" required />
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton>{labels.save}</SubmitButton>
          <Status state={state.ok ? state : { ok: false }} />
        </div>
      </form>
    </Card>
  );
}
