"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { KeyRound, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import { Field, Input, Select, SubmitButton } from "@/components/admin/ui/Form";
import { useToast } from "@/components/admin/ui/Toast";
import {
  addStaffAction,
  changeOwnPasswordAction,
  changeRoleAction,
  removeStaffAction,
} from "@/app/admin/(dashboard)/team/actions";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { AdminUser } from "@/lib/admin/auth-users";

const EMPTY: FormState = { ok: false };

/** Fires the given action's message as a toast whenever it changes. */
function useActionToast(state: FormState) {
  const { toast } = useToast();
  const seenRef = useRef<FormState | null>(null);
  useEffect(() => {
    if (!state.message || seenRef.current === state) return;
    seenRef.current = state;
    toast(state.message, state.ok ? "success" : "error");
  }, [state, toast]);
}

export default function TeamView({
  users,
  currentUserId,
  isOwner,
}: {
  users: AdminUser[];
  currentUserId: string;
  isOwner: boolean;
}) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <YourAccountCard />

      <Card padded={false}>
        <div className="p-5 sm:p-6">
          <CardHeader
            title="Team"
            subtitle={`${users.length} account${users.length === 1 ? "" : "s"} with dashboard access`}
          />
        </div>

        <ul className="divide-y divide-hairline border-t border-hairline">
          {users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              isSelf={user.id === currentUserId}
              canManage={isOwner}
            />
          ))}
        </ul>
      </Card>

      {isOwner && <AddStaffCard />}
    </div>
  );
}

function UserRow({
  user,
  isSelf,
  canManage,
}: {
  user: AdminUser;
  isSelf: boolean;
  canManage: boolean;
}) {
  const [roleState, roleAction] = useActionState(changeRoleAction, EMPTY);
  const [delState, delAction] = useActionState(removeStaffAction, EMPTY);
  const [confirming, setConfirming] = useState(false);
  useActionToast(roleState);
  useActionToast(delState);

  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5 sm:px-6">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-ember-600/10 font-display text-sm font-semibold text-ember-700">
        {user.name.charAt(0).toUpperCase()}
      </span>

      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 truncate text-sm font-medium text-heading">
          {user.name}
          {isSelf && (
            <span className="rounded border border-hairline px-1.5 py-0.5 text-[10px] font-semibold uppercase text-faint">
              you
            </span>
          )}
        </p>
        <p className="truncate text-xs text-muted">{user.email}</p>
      </div>

      <div className="shrink-0 text-right text-xs text-faint">
        {user.lastSignedInAt
          ? `Last in ${new Date(user.lastSignedInAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}`
          : "Never signed in"}
      </div>

      {canManage && !isSelf ? (
        <form action={roleAction}>
          <input type="hidden" name="id" value={user.id} />
          <select
            name="role"
            defaultValue={user.role}
            onChange={(e) => e.currentTarget.form?.requestSubmit()}
            className="h-8 rounded-lg border border-hairline bg-panel px-2 text-xs font-semibold text-heading focus:border-ember-500 focus:outline-none"
          >
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </select>
        </form>
      ) : (
        <span className="inline-flex items-center gap-1 rounded-full border border-hairline px-2.5 py-1 text-xs font-semibold capitalize text-body-text">
          {user.role === "owner" && <ShieldCheck size={12} className="text-ember-600" />}
          {user.role}
        </span>
      )}

      {canManage && !isSelf && (
        <form action={delAction}>
          <input type="hidden" name="id" value={user.id} />
          {confirming ? (
            <button
              type="submit"
              className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-danger/90"
            >
              Confirm
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              aria-label={`Remove ${user.name}`}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-danger-soft hover:text-danger"
            >
              <Trash2 size={14} />
            </button>
          )}
        </form>
      )}
    </li>
  );
}

function AddStaffCard() {
  const [state, formAction] = useActionState(addStaffAction, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  useActionToast(state);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const e = state.errors ?? {};

  return (
    <Card>
      <div className="flex items-center gap-2">
        <UserPlus size={18} className="text-ember-600" />
        <h2 className="font-display text-lg font-semibold text-heading">
          Add a staff account
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted">
        Set a temporary password and share it with them directly — there&apos;s
        no email invite yet, so this is the only way they get in.
      </p>

      <form ref={formRef} action={formAction} className="mt-5 grid gap-4 sm:grid-cols-2">
        <Field label="Name" error={e.name}>
          <Input name="name" invalid={Boolean(e.name)} required />
        </Field>
        <Field label="Email" error={e.email}>
          <Input name="email" type="email" invalid={Boolean(e.email)} required />
        </Field>
        <Field label="Temporary password" error={e.password}>
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(e.password)}
            required
          />
        </Field>
        <Field label="Role">
          <Select name="role" defaultValue="staff">
            <option value="staff">Staff</option>
            <option value="owner">Owner</option>
          </Select>
        </Field>

        <div className="sm:col-span-2">
          <SubmitButton>
            <UserPlus size={15} />
            Add account
          </SubmitButton>
        </div>
      </form>
    </Card>
  );
}

function YourAccountCard() {
  const [state, formAction] = useActionState(changeOwnPasswordAction, EMPTY);
  const formRef = useRef<HTMLFormElement>(null);
  useActionToast(state);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  const e = state.errors ?? {};

  return (
    <Card>
      <div className="flex items-center gap-2">
        <KeyRound size={18} className="text-ember-600" />
        <h2 className="font-display text-lg font-semibold text-heading">
          Change your password
        </h2>
      </div>

      <form ref={formRef} action={formAction} className="mt-5 grid gap-4 sm:grid-cols-3">
        <Field label="Current password" error={e.currentPassword}>
          <Input
            name="currentPassword"
            type="password"
            autoComplete="current-password"
            invalid={Boolean(e.currentPassword)}
            required
          />
        </Field>
        <Field label="New password" error={e.newPassword}>
          <Input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(e.newPassword)}
            required
          />
        </Field>
        <Field label="Confirm new password" error={e.confirmPassword}>
          <Input
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            invalid={Boolean(e.confirmPassword)}
            required
          />
        </Field>

        <div className="sm:col-span-3">
          <SubmitButton>Update password</SubmitButton>
        </div>
      </form>
    </Card>
  );
}
