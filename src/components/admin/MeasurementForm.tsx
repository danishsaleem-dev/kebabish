"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Field, FormError, Input, Select, SubmitButton, Textarea } from "@/components/admin/ui/Form";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import type { MeasurementForm as Form, StoredMeasurement } from "@/lib/admin/store/types";
import { MEASUREMENT_FORM_LABELS, ratioLooksOff, spoonRatio } from "@/lib/measurements";

const EMPTY: FormState = { ok: false };

export default function MeasurementForm({
  action,
  measurement,
  ingredients,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  measurement?: StoredMeasurement;
  /** Every ingredient, with the name of the row already measuring it (if any). */
  ingredients: { id: string; name: string; takenBy?: string }[];
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};
  const [tbsp, setTbsp] = useState(String(measurement?.gramsPerTbsp ?? ""));
  const [tsp, setTsp] = useState(String(measurement?.gramsPerTsp ?? ""));

  const reading = { gramsPerTbsp: Number(tbsp) || undefined, gramsPerTsp: Number(tsp) || undefined };
  const ratio = spoonRatio(reading);
  const off = ratioLooksOff(reading);

  return (
    <form action={formAction} className="space-y-5">
      {measurement && <input type="hidden" name="id" value={measurement.id} />}
      <FormError message={state.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Name (English)" error={e.nameEn}>
          <Input name="nameEn" defaultValue={measurement?.nameEn} placeholder="Ajwain Seeds" invalid={Boolean(e.nameEn)} required />
        </Field>
        <Field label="Name (Roman Urdu)" hint="Optional. As the kitchen says it." error={e.nameUr}>
          <Input name="nameUr" defaultValue={measurement?.nameUr ?? ""} placeholder="Ajwain" />
        </Field>

        <Field
          label="Ingredient"
          hint="The ingredient in your price list this measures. One measurement per ingredient, so nothing is entered twice. Leave empty if it isn't in the list yet."
          error={e.ingredientId}
          className="sm:col-span-2"
        >
          <Select name="ingredientId" defaultValue={measurement?.ingredientId ?? ""} invalid={Boolean(e.ingredientId)}>
            <option value="">Not linked</option>
            {ingredients.map((i) => (
              <option key={i.id} value={i.id} disabled={Boolean(i.takenBy) && i.id !== measurement?.ingredientId}>
                {i.name}
                {i.takenBy && i.id !== measurement?.ingredientId ? ` — already measured by “${i.takenBy}”` : ""}
              </option>
            ))}
          </Select>
        </Field>

        <Field label="Grams in 1 tablespoon (tbsp)" hint="Leave empty if it wasn't measured." error={e.gramsPerTbsp}>
          <Input
            name="gramsPerTbsp"
            type="number"
            step="any"
            min="0"
            value={tbsp}
            onChange={(ev) => setTbsp(ev.target.value)}
            placeholder="7.74"
            invalid={Boolean(e.gramsPerTbsp)}
          />
        </Field>
        <Field label="Grams in 1 teaspoon (tsp)" hint="Leave empty if it wasn't measured." error={e.gramsPerTsp}>
          <Input
            name="gramsPerTsp"
            type="number"
            step="any"
            min="0"
            value={tsp}
            onChange={(ev) => setTsp(ev.target.value)}
            placeholder="2.68"
            invalid={Boolean(e.gramsPerTsp)}
          />
        </Field>

        {ratio !== null && (
          <p
            className={`rounded-lg px-3.5 py-2.5 text-sm sm:col-span-2 ${
              off ? "bg-warn-soft font-medium text-warn" : "bg-canvas text-muted"
            }`}
          >
            1 tbsp is {ratio}× a tsp.{" "}
            {off
              ? "A tablespoon is 3 teaspoons, so this is worth a second look (was one spoon heaped, or a number mistyped?)."
              : "That agrees with 1 tbsp = 3 tsp."}
          </p>
        )}

        <Field label="Form" hint="The chart's tag, if it has one." error={e.form}>
          <Select name="form" defaultValue={measurement?.form ?? ""}>
            <option value="">None</option>
            {(Object.keys(MEASUREMENT_FORM_LABELS) as Form[]).map((f) => (
              <option key={f} value={f}>
                {MEASUREMENT_FORM_LABELS[f]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Note" hint="Optional." error={e.note}>
          <Textarea name="note" rows={2} defaultValue={measurement?.note ?? ""} maxLength={200} />
        </Field>
      </div>

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <SubmitButton>{measurement ? "Save changes" : "Add measurement"}</SubmitButton>
        <Link
          href="/admin/menu/measurements"
          className="rounded-lg border border-hairline px-5 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
