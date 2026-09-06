"use client";

import { useActionState, useState } from "react";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import {
  Field,
  Input,
  Select,
  Checkbox,
  SubmitButton,
  FormError,
} from "@/components/admin/ui/Form";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { StoredPromoCode } from "@/lib/admin/store/types";

export default function PromoCodeForm({
  promo,
  action,
  submitLabel,
}: {
  promo?: StoredPromoCode;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(action, { ok: false });
  const [type, setType] = useState<"percentage" | "fixed">(
    promo?.type ?? "percentage"
  );

  return (
    <form action={formAction} className="space-y-4 sm:space-y-6">
      {promo && <input type="hidden" name="id" value={promo.id} />}

      <Card>
        <CardHeader
          title={promo ? `Edit “${promo.code}”` : "New promo code"}
          subtitle="A code customers enter at checkout for a percentage or fixed-amount discount."
        />

        <div className="mt-4 space-y-4">
          <Field label="Code" hint="Letters, numbers and dashes only." error={state.errors?.code}>
            <Input
              name="code"
              defaultValue={promo?.code}
              placeholder="WELCOME10"
              className="uppercase"
              invalid={Boolean(state.errors?.code)}
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Discount type" error={state.errors?.type}>
              <Select
                name="type"
                value={type}
                onChange={(e) => setType(e.target.value as "percentage" | "fixed")}
                invalid={Boolean(state.errors?.type)}
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed">Fixed amount off</option>
              </Select>
            </Field>

            <Field
              label={type === "percentage" ? "Percentage" : "Amount"}
              hint={type === "percentage" ? "1–100" : "In euros"}
              error={state.errors?.value}
            >
              <div className="relative">
                {type === "fixed" && (
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    €
                  </span>
                )}
                <Input
                  type="number"
                  name="value"
                  step={type === "percentage" ? 1 : 0.05}
                  min={0}
                  max={type === "percentage" ? 100 : undefined}
                  defaultValue={promo?.value}
                  className={type === "fixed" ? "pl-7" : ""}
                  invalid={Boolean(state.errors?.value)}
                />
                {type === "percentage" && (
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                    %
                  </span>
                )}
              </div>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Minimum order"
              hint="Leave empty for no minimum."
              error={state.errors?.minOrder}
            >
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted">
                  €
                </span>
                <Input
                  type="number"
                  name="minOrder"
                  step={0.05}
                  min={0}
                  defaultValue={promo?.minOrder ?? ""}
                  className="pl-7"
                  invalid={Boolean(state.errors?.minOrder)}
                />
              </div>
            </Field>

            <Field
              label="Expires on"
              hint="Leave empty for no expiry."
              error={state.errors?.expiresAt}
            >
              <Input
                type="date"
                name="expiresAt"
                defaultValue={promo?.expiresAt ?? ""}
                invalid={Boolean(state.errors?.expiresAt)}
              />
            </Field>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Checkbox
              name="active"
              label="Active"
              defaultChecked={promo?.active ?? true}
            />
            <Checkbox
              name="singleUsePerCustomer"
              label="One use per customer"
              defaultChecked={promo?.singleUsePerCustomer ?? false}
            />
          </div>
        </div>
      </Card>

      <FormError message={state.message && !state.ok ? state.message : undefined} />

      <div className="flex justify-end">
        <SubmitButton>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}
