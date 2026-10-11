"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2, Mail } from "lucide-react";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import AuthFrame from "@/components/shared/AuthFrame";
import { requestPasswordResetAction } from "@/app/(auth)/forgot-password/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export default function ForgotPasswordForm() {
  const [state, formAction] = useActionState(requestPasswordResetAction, EMPTY);

  return (
    <AuthFrame
      title="Forgot your password?"
      subtitle="We'll email you a link to choose a new one."
    >
      {state.ok ? (
        <div className="space-y-4 text-center">
          <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-success-soft text-success">
            <CheckCircle2 size={22} />
          </span>
          <p className="text-sm leading-relaxed text-body-text">{state.message}</p>
          <p className="text-xs text-muted">
            Nothing in your inbox? Check your spam folder, or try again in a minute.
          </p>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <FormError message={state.message} />
          <Field label="Email" error={state.errors?.email}>
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <SubmitButton>
            <Mail size={15} />
            Send reset link
          </SubmitButton>
        </form>
      )}

      <p className="mt-5 text-center text-sm text-muted">
        <Link href="/login" className="font-semibold text-ember-600 hover:underline">
          Back to sign in
        </Link>
      </p>
    </AuthFrame>
  );
}
