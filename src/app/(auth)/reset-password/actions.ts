"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { setAccountPassword, verifyResetToken } from "@/lib/password-reset";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const passwordSchema = z
  .object({
    password: z.string().min(8, "Password needs to be at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "The two passwords don't match.",
    path: ["confirm"],
  });

export async function resetPasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = passwordSchema.safeParse({
    password: formData.get("password"),
    confirm: formData.get("confirm"),
  });
  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { ok: false, errors };
  }

  // Checked again here, not just when the page rendered: the token has to
  // still be valid at the moment the password is written.
  const account = await verifyResetToken(String(formData.get("token") ?? ""));
  if (!account) {
    return {
      ok: false,
      message: "This link has expired or was already used. Ask for a new one.",
    };
  }

  // An account created at checkout (no password until now) gets its own welcome; either
  // way the email is filled in on the sign-in page so they only type the password.
  const first = !account.hasPassword;
  await setAccountPassword(account, parsed.data.password);
  redirect(
    `/login?notice=${first ? "account-ready" : "password-reset"}&email=${encodeURIComponent(account.email)}`
  );
}
