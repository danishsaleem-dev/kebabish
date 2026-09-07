import "server-only";
import bcrypt from "bcryptjs";
import { supabaseAdmin } from "@/lib/supabase/server";

export type AdminRole = "owner" | "staff" | "rider";

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
  createdAt: string;
  lastSignedInAt: string | null;
}

const SALT_ROUNDS = 12;

/** Used only by the credentials sign-in check — carries the hash. */
async function findByEmailWithHash(email: string) {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("id, email, name, role, password_hash")
    .ilike("email", email.trim())
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function verifyCredentials(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const user = await findByEmailWithHash(email);
  if (!user) return null;

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return null;

  await supabaseAdmin()
    .from("admin_users")
    .update({ last_signed_in_at: new Date().toISOString() })
    .eq("id", user.id);

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: "",
    lastSignedInAt: null,
  };
}

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("id, email, name, role, created_at, last_signed_in_at")
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    lastSignedInAt: row.last_signed_in_at,
  }));
}

/** For the "assign a rider" dropdown on an order. */
export async function listRiders(): Promise<AdminUser[]> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("id, email, name, role, created_at, last_signed_in_at")
    .eq("role", "rider")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    createdAt: row.created_at,
    lastSignedInAt: row.last_signed_in_at,
  }));
}

export async function countAdminUsers(): Promise<number> {
  // Deliberately not a `head: true` count query: against a table that
  // doesn't exist yet (e.g. the migration hasn't been run), supabase-js
  // returns { count: null, error: null, status: 204 } for HEAD requests —
  // the missing-table error is silently swallowed. A normal select
  // correctly surfaces it as a real error instead of a false "0 users",
  // which matters a lot here since "0 users" is exactly what shows the
  // account-bootstrap form on the login page.
  const { data, error } = await supabaseAdmin().from("admin_users").select("id");

  if (error) throw new Error(error.message);
  return data?.length ?? 0;
}

export async function createAdminUser(input: {
  email: string;
  password: string;
  name: string;
  role: AdminRole;
}): Promise<AdminUser> {
  const password_hash = await bcrypt.hash(input.password, SALT_ROUNDS);

  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .insert({
      email: input.email.trim(),
      password_hash,
      name: input.name.trim(),
      role: input.role,
    })
    .select("id, email, name, role, created_at, last_signed_in_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error("An account with that email already exists.");
    }
    throw new Error(error.message);
  }

  return {
    id: data.id,
    email: data.email,
    name: data.name,
    role: data.role,
    createdAt: data.created_at,
    lastSignedInAt: data.last_signed_in_at,
  };
}

export async function deleteAdminUser(id: string): Promise<void> {
  const { error } = await supabaseAdmin().from("admin_users").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function updateAdminUserPassword(
  id: string,
  newPassword: string
): Promise<void> {
  const password_hash = await bcrypt.hash(newPassword, SALT_ROUNDS);
  const { error } = await supabaseAdmin()
    .from("admin_users")
    .update({ password_hash })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

/** Used by the "change your password" form to re-check the current one. */
export async function verifyPasswordById(
  id: string,
  password: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from("admin_users")
    .select("password_hash")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return false;
  return bcrypt.compare(password, data.password_hash);
}

export async function updateAdminUserRole(
  id: string,
  role: AdminRole
): Promise<void> {
  const { error } = await supabaseAdmin()
    .from("admin_users")
    .update({ role })
    .eq("id", id);
  if (error) throw new Error(error.message);
}
