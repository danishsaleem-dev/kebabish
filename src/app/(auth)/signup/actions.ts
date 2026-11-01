"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AuthError } from "next-auth";
import { signIn } from "@/lib/auth";
import { createCustomer } from "@/lib/customers/accounts";
import { getTranslations } from "next-intl/server";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

export async function signupAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const locale = formData.get("locale") === "en" ? "en" : "nl";
  const t = await getTranslations({ locale, namespace: "auth" });
  const signupSchema = z.object({
    name: z.string().trim().min(2, t("errName")),
    email: z.string().trim().email(t("errEmail")),
    phone: z.string().trim().optional(),
    marketingOptIn: z.boolean(),
    password: z.string().min(8, t("errPassword")),
  });

  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone") || undefined,
    // A checkbox only counts when it is actually ticked — never defaulted.
    marketingOptIn: formData.get("marketingOptIn") === "on",
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
    const message = (error as Error).message;
    return {
      ok: false,
      message: message === "An account with that email already exists." ? t("errExists") : message,
    };
  }

  try {
    const result = await signIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirect: false,
    });
    if (result?.error) {
      return { ok: false, message: t("errCreated") };
    }
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, message: t("errCreated") };
    }
    throw error;
  }

  redirect("/dashboard");
}
