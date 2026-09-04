"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { createCustomer } from "@/lib/customers/accounts";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: z.string().trim().email("That doesn't look like an email address."),
  phone: z.string().trim().optional(),
  password: z.string().min(8, "Password needs to be at least 8 characters."),
});

export async function signupAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    password: formData.get("password"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { ok: false, errors };
  }

  try {
    await createCustomer(parsed.data);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    if (result?.error) {
      return {
        ok: false,
        message: "Account created — sign in with your new password.",
      };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        ok: false,
        message: "Account created — sign in with your new password.",
      };
    }
    throw error;
  }

  redirect("/dashboard");
}
