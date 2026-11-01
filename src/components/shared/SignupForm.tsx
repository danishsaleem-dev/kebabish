"use client";

import { useActionState } from "react";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import PasswordInput from "@/components/shared/PasswordInput";
import { signupAction } from "@/app/(auth)/signup/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export default function SignupForm({
  locale,
  defaultName,
  defaultEmail,
  defaultPhone,
  labels,
}: {
  locale: string;
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
  labels: {
    name: string;
    email: string;
    phone: string;
    phoneHint: string;
    password: string;
    passwordHint: string;
    showPassword: string;
    hidePassword: string;
    marketing: string;
    marketingHint: string;
    createAccount: string;
    haveAccount: string;
    signInLink: string;
  };
}) {
  const [state, formAction] = useActionState(signupAction, EMPTY);
  const e = state.errors ?? {};

  return (
    <>
      <form action={formAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <FormError message={!state.ok ? state.message : undefined} />

        <Field label={labels.name} error={e.name}>
          <Input name="name" autoComplete="name" defaultValue={defaultName} invalid={Boolean(e.name)} required />
        </Field>

        <Field label={labels.email} error={e.email}>
          <Input
            name="email"
            type="email"
            autoComplete="email"
            defaultValue={defaultEmail}
            invalid={Boolean(e.email)}
            required
          />
        </Field>

        <Field label={labels.phone} hint={labels.phoneHint} error={e.phone}>
          <Input name="phone" type="tel" autoComplete="tel" defaultValue={defaultPhone} />
        </Field>

        <Field label={labels.password} hint={labels.passwordHint} error={e.password}>
          <PasswordInput
            name="password"
            autoComplete="new-password"
            showLabel={labels.showPassword}
            hideLabel={labels.hidePassword}
            invalid={Boolean(e.password)}
            required
          />
        </Field>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-body-text">
          <input
            type="checkbox"
            name="marketingOptIn"
            className="mt-0.5 h-4 w-4 shrink-0 rounded border-hairline accent-ember-600"
          />
          <span>
            {labels.marketing}
            <span className="block text-xs text-muted">{labels.marketingHint}</span>
          </span>
        </label>

        <SubmitButton>
          <UserPlus size={15} />
          {labels.createAccount}
        </SubmitButton>
      </form>

      <p className="mt-5 text-center text-sm text-muted">
        {labels.haveAccount}{" "}
        <Link href={`/login?lang=${locale}`} className="font-semibold text-ember-700 hover:underline">
          {labels.signInLink}
        </Link>
      </p>
    </>
  );
}
