"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function Field({
  label,
  hint,
  error,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="mb-1.5 block text-sm font-medium text-heading">
        {label}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-danger">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-muted">{hint}</span>
      )}
    </label>
  );
}

const inputBase =
  "w-full rounded-lg border bg-panel px-3 py-2.5 text-sm text-heading placeholder:text-faint focus:outline-none focus:ring-2 focus:ring-ember-500/25";

export function Input({
  invalid,
  className = "",
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return (
    <input
      {...props}
      className={`${inputBase} ${
        invalid ? "border-danger" : "border-hairline focus:border-ember-500"
      } ${className}`}
    />
  );
}

export function Textarea({
  invalid,
  className = "",
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return (
    <textarea
      {...props}
      className={`${inputBase} ${
        invalid ? "border-danger" : "border-hairline focus:border-ember-500"
      } ${className}`}
    />
  );
}

export function Select({
  invalid,
  className = "",
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select
      {...props}
      className={`${inputBase} ${
        invalid ? "border-danger" : "border-hairline focus:border-ember-500"
      } ${className}`}
    >
      {children}
    </select>
  );
}

export function Checkbox({
  label,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-hairline px-3 py-2.5">
      <input
        type="checkbox"
        {...props}
        className="h-4 w-4 rounded border-hairline accent-ember-600"
      />
      <span className="text-sm text-body-text">{label}</span>
    </label>
  );
}

/** Submit button that disables and spins while the action is in flight. */
export function SubmitButton({
  children,
  variant = "primary",
}: {
  children: ReactNode;
  variant?: "primary" | "danger";
}) {
  const { pending } = useFormStatus();

  const tone =
    variant === "danger"
      ? "bg-danger text-white hover:bg-danger/90"
      : "bg-ember-600 text-cream-50 hover:bg-ember-500";

  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60 ${tone}`}
    >
      {pending && <Loader2 size={15} className="animate-spin" />}
      {children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg bg-danger-soft px-3 py-2.5 text-sm font-medium text-danger">
      {message}
    </p>
  );
}
