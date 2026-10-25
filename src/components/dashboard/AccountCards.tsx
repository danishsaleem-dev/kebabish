"use client";

import { useActionState } from "react";
import { Check, KeyRound, Loader2, MailCheck, Send, UserCog } from "lucide-react";
import Card from "@/components/admin/ui/Card";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import {
  changePasswordAction,
  resendSetupEmailAction,
  updateProfileAction,
} from "@/app/dashboard/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

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
 * Shown while the account has no password yet (it was created when an order was paid).
 * Says what to do — open the email, choose a password — and offers to send it again.
 */
export function ConfirmAccountBanner({ email }: { email: string }) {
  const [state, action, pending] = useActionState(resendSetupEmailAction, EMPTY);
  return (
    <Card className="border-ember-600/30 bg-ember-600/5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ember-600/10 text-ember-600">
            <MailCheck size={20} aria-hidden="true" />
          </span>
          <div>
            <h2 className="font-display text-base font-semibold text-heading">Confirm your account</h2>
            <p className="mt-0.5 max-w-xl text-sm text-body-text">
              We created this account from your order and emailed <strong>{email}</strong>. Open that email and
              choose a password — then you can sign in any time. Until then you can see your orders here, but
              only on this device.
            </p>
            <div className="mt-2 min-h-5">
              <Status state={state} />
            </div>
          </div>
        </div>
        <form action={action}>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex items-center gap-2 rounded-lg border border-ember-600/40 bg-panel px-4 py-2.5 text-sm font-semibold text-ember-700 transition-colors hover:bg-ember-600/10 disabled:opacity-60"
          >
            {pending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            Send it again
          </button>
        </form>
      </div>
    </Card>
  );
}

/** Name and phone. The email address is the account itself, so it is shown, not edited. */
export function ProfileCard({
  name,
  email,
  phone,
}: {
  name: string;
  email: string;
  phone: string;
}) {
  const [state, action] = useActionState(updateProfileAction, EMPTY);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserCog size={18} className="text-ember-600" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-heading">Your details</h2>
      </div>
      <form action={action} className="mt-4 space-y-4">
        <FormError message={!state.ok && !state.errors ? state.message : undefined} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name" error={state.errors?.name}>
            <Input name="name" defaultValue={name} autoComplete="name" required maxLength={80} />
          </Field>
          <Field label="Phone" hint="Optional. Dutch numbers only." error={state.errors?.phone}>
            <Input name="phone" type="tel" defaultValue={phone} autoComplete="tel" inputMode="tel" />
          </Field>
        </div>
        <Field label="Email" hint="This is your sign-in. To change it, contact us.">
          <Input value={email} readOnly disabled aria-readonly="true" />
        </Field>
        <div className="flex items-center gap-3">
          <SubmitButton>Save details</SubmitButton>
          <Status state={state.ok ? state : { ok: false }} />
        </div>
      </form>
    </Card>
  );
}

/** Change password, for an account that already has one. */
export function PasswordCard() {
  const [state, action] = useActionState(changePasswordAction, EMPTY);
  return (
    <Card>
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-ember-600" aria-hidden="true" />
        <h2 className="font-display text-lg font-semibold text-heading">Password</h2>
      </div>
      <form action={action} key={state.ok ? "done" : "form"} className="mt-4 space-y-4">
        <FormError message={!state.ok && !state.errors ? state.message : undefined} />
        <Field label="Current password" error={state.errors?.current}>
          <Input name="current" type="password" autoComplete="current-password" required />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="New password" hint="At least 8 characters." error={state.errors?.password}>
            <Input name="password" type="password" autoComplete="new-password" required />
          </Field>
          <Field label="Repeat the new password" error={state.errors?.confirm}>
            <Input name="confirm" type="password" autoComplete="new-password" required />
          </Field>
        </div>
        <div className="flex items-center gap-3">
          <SubmitButton>Change password</SubmitButton>
          <Status state={state.ok ? state : { ok: false }} />
        </div>
      </form>
    </Card>
  );
}
