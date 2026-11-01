"use client";

import { useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/admin/ui/Form";

/**
 * A password field with an eye button to check what was typed. On a phone a mistyped password is
 * the commonest reason a signup or sign-in fails. The field stays type="password" until the
 * button is pressed, so password managers still recognise it.
 */
export default function PasswordInput({
  invalid,
  showLabel = "Show password",
  hideLabel = "Hide password",
  className = "",
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & {
  invalid?: boolean;
  showLabel?: string;
  hideLabel?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <span className="relative block">
      <Input {...props} type={visible ? "text" : "password"} invalid={invalid} className={`pr-12 ${className}`} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? hideLabel : showLabel}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-lg text-muted transition-colors hover:text-ember-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ember-500"
      >
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </span>
  );
}
