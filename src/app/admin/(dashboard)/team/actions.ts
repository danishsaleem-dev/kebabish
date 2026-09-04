"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createAdminUser,
  deleteAdminUser,
  listAdminUsers,
  updateAdminUserPassword,
  updateAdminUserRole,
  verifyPasswordById,
  type AdminRole,
} from "@/lib/admin/auth-users";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";

async function requireOwner() {
  const session = await auth();
  if (session?.user.role !== "owner") {
    throw new Error("Only an owner can do that.");
  }
  return session.user;
}

const addStaffSchema = z.object({
  name: z.string().trim().min(2, "Give them a name."),
  email: z.string().trim().email("That doesn't look like an email address."),
  password: z.string().min(8, "Password needs to be at least 8 characters."),
  role: z.enum(["owner", "staff"]),
});

export async function addStaffAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await requireOwner();
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  const parsed = addStaffSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
    role: formData.get("role"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { ok: false, errors };
  }

  try {
    await createAdminUser(parsed.data);
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  revalidatePath("/admin/team");
  return { ok: true, message: `${parsed.data.name} can now sign in.` };
}

export async function removeStaffAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  let ownerId: string;
  try {
    ownerId = (await requireOwner()).id;
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  const id = String(formData.get("id") ?? "");

  if (id === ownerId) {
    return { ok: false, message: "You can't remove your own account here." };
  }

  const users = await listAdminUsers();
  const target = users.find((u) => u.id === id);
  const remainingOwners = users.filter(
    (u) => u.role === "owner" && u.id !== id
  ).length;

  if (target?.role === "owner" && remainingOwners === 0) {
    return { ok: false, message: "There has to be at least one owner." };
  }

  await deleteAdminUser(id);
  revalidatePath("/admin/team");
  return { ok: true, message: `${target?.name ?? "Account"} removed.` };
}

export async function changeRoleAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  try {
    await requireOwner();
  } catch (error) {
    return { ok: false, message: (error as Error).message };
  }

  const id = String(formData.get("id") ?? "");
  const role = formData.get("role") === "owner" ? "owner" : "staff" satisfies AdminRole;

  if (role === "staff") {
    const users = await listAdminUsers();
    const remainingOwners = users.filter(
      (u) => u.role === "owner" && u.id !== id
    ).length;
    if (remainingOwners === 0) {
      return { ok: false, message: "There has to be at least one owner." };
    }
  }

  await updateAdminUserRole(id, role);
  revalidatePath("/admin/team");
  return { ok: true, message: "Role updated." };
}

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: z.string().min(8, "New password needs to be at least 8 characters."),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match.",
    path: ["confirmPassword"],
  });

export async function changeOwnPasswordAction(
  _prev: FormState,
  formData: FormData
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { ok: false, message: "Sign in again to do that." };

  const parsed = passwordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    const errors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      errors[issue.path.join(".") || "form"] ??= issue.message;
    }
    return { ok: false, errors };
  }

  const valid = await verifyPasswordById(
    session.user.id,
    parsed.data.currentPassword
  );
  if (!valid) {
    return { ok: false, errors: { currentPassword: "That's not your current password." } };
  }

  await updateAdminUserPassword(session.user.id, parsed.data.newPassword);
  return { ok: true, message: "Password changed." };
}
