"use client";

import { useActionState } from "react";
import BrandLogo from "@/components/shared/BrandLogo";
import Link from "next/link";
import { LogIn, Sparkles } from "lucide-react";
import { Field, FormError, Input, SubmitButton } from "@/components/admin/ui/Form";
import { bootstrapOwnerAction, loginAction } from "@/app/(auth)/login/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const EMPTY: FormState = { ok: false };

export default function LoginForm({
  isBootstrap,
  defaultEmail,
}: {
  isBootstrap: boolean;
  defaultEmail?: string;
}) {
  const [state, formAction] = useActionState(
    isBootstrap ? bootstrapOwnerAction : loginAction,
    EMPTY
  );

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
            {isBootstrap ? "Set up your admin account" : "Sign in"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {isBootstrap
              ? "You're the first to sign in — create the owner account."
              : "Kebabish"}
          </p>
        </div>

        <div className="rounded-2xl border border-hairline bg-panel p-6 shadow-sm">
          {isBootstrap && (
            <p className="mb-5 flex items-start gap-2 rounded-xl bg-ember-600/10 p-3 text-xs leading-relaxed text-ember-700">
              <Sparkles size={15} className="mt-0.5 shrink-0" />
              This form only appears because no admin account exists yet. Once
              you create one, everyone else signs in normally and new staff
              are added from the Team screen.
            </p>
          )}

          <form action={formAction} className="space-y-4">
            <FormError message={!state.ok ? state.message : undefined} />

            {isBootstrap && (
              <Field label="Your name">
                <Input name="name" autoComplete="name" required />
              </Field>
            )}

            <Field label="Email">
              <Input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={defaultEmail}
                required
              />
            </Field>

            <Field
              label="Password"
              hint={isBootstrap ? "At least 8 characters." : undefined}
            >
              <Input
                name="password"
                type="password"
                autoComplete={isBootstrap ? "new-password" : "current-password"}
                required
              />
            </Field>

            <SubmitButton>
              <LogIn size={15} />
              {isBootstrap ? "Create account & sign in" : "Sign in"}
            </SubmitButton>
          </form>

          {!isBootstrap && (
            <p className="mt-5 text-center text-sm text-muted">
              New customer?{" "}
              <Link
                href="/signup"
                className="font-semibold text-ember-600 hover:underline"
              >
                Create an account
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
