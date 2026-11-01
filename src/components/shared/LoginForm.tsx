"use client";

import { useActionState } from "react";
import Link from "next/link";
import { LogIn, Sparkles } from "lucide-react";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import PasswordInput from "@/components/shared/PasswordInput";
import { bootstrapOwnerAction, loginAction } from "@/app/(auth)/login/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export default function LoginForm({
  locale,
  isBootstrap,
  defaultEmail,
  notice,
  labels,
}: {
  locale: string;
  isBootstrap: boolean;
  defaultEmail?: string;
  /** A positive message to show above the form, e.g. after a password reset. */
  notice?: string;
  labels: {
    email: string;
    password: string;
    passwordHint: string;
    showPassword: string;
    hidePassword: string;
    forgot: string;
    signIn: string;
    newCustomer: string;
    createLink: string;
  };
}) {
  const [state, formAction] = useActionState(
    isBootstrap ? bootstrapOwnerAction : loginAction,
    EMPTY
  );

  return (
    <>
      {isBootstrap && (
        <p className="mb-5 flex items-start gap-2 rounded-xl bg-ember-600/10 p-3 text-xs leading-relaxed text-ember-700">
          <Sparkles size={15} className="mt-0.5 shrink-0" />
          This form only appears because no admin account exists yet. Once
          you create one, everyone else signs in normally and new staff
          are added from the Team screen.
        </p>
      )}

      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        {notice && (
          <p role="status" className="rounded-xl bg-success-soft px-3 py-2.5 text-sm font-medium text-success">
            {notice}
          </p>
        )}
        <FormError message={!state.ok ? state.message : undefined} />

        {isBootstrap && (
          <Field label="Your name">
            <Input name="name" autoComplete="name" required />
          </Field>
        )}

        <Field label={labels.email}>
          <Input name="email" type="email" autoComplete="email" defaultValue={defaultEmail} required />
        </Field>

        <Field label={labels.password} hint={isBootstrap ? labels.passwordHint : undefined}>
          <PasswordInput
            name="password"
            autoComplete={isBootstrap ? "new-password" : "current-password"}
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
            required
          />
        </Field>

        {!isBootstrap && (
          <p className="-mt-1 text-right text-xs">
            <Link href="/forgot-password" className="font-semibold text-ember-700 hover:underline">
              {labels.forgot}
            </Link>
          </p>
        )}

        <SubmitButton>
          <LogIn size={15} />
          {isBootstrap ? "Create account & sign in" : labels.signIn}
        </SubmitButton>
      </form>

      {!isBootstrap && (
        <p className="mt-5 text-center text-sm text-muted">
          {labels.newCustomer}{" "}
          <Link href={`/signup?lang=${locale}`} className="font-semibold text-ember-700 hover:underline">
            {labels.createLink}
          </Link>
        </p>
      )}
    </>
  );
}
