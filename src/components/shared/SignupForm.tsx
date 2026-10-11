"use client";

import { useActionState } from "react";
import BrandLogo from "@/components/shared/BrandLogo";
import Link from "next/link";
import { UserPlus } from "lucide-react";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import { signupAction } from "@/app/(auth)/signup/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export default function SignupForm({
  defaultName,
  defaultEmail,
  defaultPhone,
}: {
  defaultName?: string;
  defaultEmail?: string;
  defaultPhone?: string;
} = {}) {
  const [state, formAction] = useActionState(signupAction, EMPTY);
  const e = state.errors ?? {};

  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center text-center">
          <BrandLogo
            src="/logo/Kebabish-light.png"
            alt="Kebabish"
            width={300}
            height={225}
            priority
            className="h-14 w-auto"
          />
          <h1 className="mt-5 font-display text-xl font-semibold text-heading">
            Create your account
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track your orders and check out faster next time.
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-panel p-6 shadow-sm">
          <form action={formAction} className="space-y-4">
            <FormError message={!state.ok ? state.message : undefined} />

            <Field label="Name" error={e.name}>
              <Input
                name="name"
                autoComplete="name"
                defaultValue={defaultName}
                invalid={Boolean(e.name)}
                required
              />
            </Field>

            <Field label="Email" error={e.email}>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={defaultEmail}
                invalid={Boolean(e.email)}
                required
              />
            </Field>

            <Field label="Phone" hint="Optional." error={e.phone}>
              <Input
                name="phone"
                type="tel"
                autoComplete="tel"
                defaultValue={defaultPhone}
              />
            </Field>

            <Field label="Password" hint="At least 8 characters." error={e.password}>
              <Input
                name="password"
                type="password"
                autoComplete="new-password"
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
                I want to receive offers and news from Kebabish.
                <span className="block text-xs text-muted">
                  Optional. You can switch this off any time in your account.
                </span>
              </span>
            </label>

            <SubmitButton>
              <UserPlus size={15} />
              Create account
            </SubmitButton>
          </form>

          <p className="mt-5 text-center text-sm text-muted">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-ember-600 hover:underline"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
