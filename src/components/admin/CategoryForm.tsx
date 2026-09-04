"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Checkbox,
  Field,
  FormError,
  Input,
  SubmitButton,
  Textarea,
} from "@/components/admin/ui/Form";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import ImageField from "@/components/admin/media/ImageField";
import type { StoredCategory, StoredMedia } from "@/lib/admin/store/types";

const EMPTY: FormState = { ok: false };

export default function CategoryForm({
  action,
  category,
  library,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  category?: StoredCategory;
  library: StoredMedia[];
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {category && <input type="hidden" name="id" value={category.id} />}
      <FormError message={state.message} />

      <Field label="Category name" error={e.label}>
        <Input
          name="label"
          defaultValue={category?.label}
          placeholder="Main Dishes"
          invalid={Boolean(e.label)}
          required
        />
      </Field>

      <Field
        label="Description"
        hint="Shown to you in the admin panel, not on the public site."
        error={e.description}
      >
        <Textarea
          name="description"
          rows={3}
          defaultValue={category?.description}
          placeholder="Rice plates and curries — the core of the menu."
          invalid={Boolean(e.description)}
        />
      </Field>

      <ImageField
        library={library}
        initialId={category?.imageId}
        hint="Shown on the public menu as the category header."
      />

      <Checkbox
        name="visible"
        label="Visible on the public menu"
        defaultChecked={category ? category.visible : true}
      />

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <SubmitButton>
          {category ? "Save changes" : "Create category"}
        </SubmitButton>
        <Link
          href="/admin/menu/categories"
          className="rounded-lg border border-hairline px-5 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
