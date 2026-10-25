"use client";

import { useActionState } from "react";
import { KeyRound } from "lucide-react";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import AuthFrame from "@/components/shared/AuthFrame";
import { resetPasswordAction } from "@/app/(auth)/reset-password/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export default function ResetPasswordForm({
  token,
  welcome = false,
}: {
  token: string;
  /** An account created at checkout choosing its first password, rather than a reset. */
  welcome?: boolean;
}) {
  const [state, formAction] = useActionState(resetPasswordAction, EMPTY);

  return (
    <AuthFrame
      title={welcome ? "Choose your password" : "Choose a new password"}
      subtitle={
        welcome
          ? "This confirms your account. Next time, sign in with your email and this password."
          : "Pick something you don't use anywhere else."
      }
    >
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <FormError message={!state.ok ? state.message : undefined} />
        <Field label={welcome ? "Password" : "New password"} hint="At least 8 characters." error={state.errors?.password}>
          <Input name="password" type="password" autoComplete="new-password" required />
        </Field>
        <Field label="Repeat the password" error={state.errors?.confirm}>
          <Input name="confirm" type="password" autoComplete="new-password" required />
        </Field>
        <SubmitButton>
          <KeyRound size={15} />
          {welcome ? "Confirm my account" : "Save new password"}
        </SubmitButton>
      </form>
    </AuthFrame>
  );
}
