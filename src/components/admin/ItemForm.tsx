"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  Checkbox,
  Field,
  FormError,
  Input,
  Select,
  SubmitButton,
} from "@/components/admin/ui/Form";
import type { FormState } from "@/app/admin/(dashboard)/menu/actions";
import GalleryField from "@/components/admin/media/GalleryField";
import type {
  StoredCategory,
  StoredItem,
  StoredMedia,
} from "@/lib/admin/store/types";

const EMPTY: FormState = { ok: false };

export default function ItemForm({
  action,
  categories,
  item,
  library,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  categories: StoredCategory[];
  item?: StoredItem;
  library: StoredMedia[];
}) {
  const [state, formAction] = useActionState(action, EMPTY);
  const e = state.errors ?? {};

  return (
    <form action={formAction} className="space-y-5">
      {item && <input type="hidden" name="slug" value={item.slug} />}
      <FormError message={state.message} />

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Dish name" error={e.name} className="sm:col-span-2">
          <Input
            name="name"
            defaultValue={item?.name}
            placeholder="Chicken Biryani"
            invalid={Boolean(e.name)}
            required
          />
        </Field>

        <Field label="Category" error={e.categoryId}>
          <Select
            name="categoryId"
            defaultValue={item?.categoryId ?? categories[0]?.id}
            invalid={Boolean(e.categoryId)}
          >
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </Field>

        <Field
          label="Price (€)"
          hint="Leave empty to show “price on request”."
          error={e.price}
        >
          <Input
            name="price"
            type="number"
            step="0.01"
            min="0"
            defaultValue={item?.price ?? ""}
            placeholder="12.50"
            invalid={Boolean(e.price)}
          />
        </Field>

        <Field
          label="Variants"
          hint="Comma separated, e.g. Mango, Banana, Strawberry"
          error={e.variants}
          className="sm:col-span-2"
        >
          <Input
            name="variants"
            defaultValue={item?.variants.join(", ")}
            placeholder="Mango, Banana, Strawberry"
          />
        </Field>
      </div>

      <div className="border-t border-hairline pt-5">
        <GalleryField library={library} initialIds={item?.imageIds ?? []} />
      </div>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-1.5 text-sm font-medium text-heading">
          Labels
        </legend>
        <Checkbox
          name="vegetarian"
          label="Vegetarian"
          defaultChecked={item?.vegetarian}
        />
        <Checkbox name="spicy" label="Spicy" defaultChecked={item?.spicy} />
        <Checkbox
          name="soldOut"
          label="Sold out"
          defaultChecked={item?.soldOut}
        />
      </fieldset>

      <div className="flex items-center gap-3 border-t border-hairline pt-5">
        <SubmitButton>{item ? "Save changes" : "Create dish"}</SubmitButton>
        <Link
          href={item ? `/admin/menu/recipes/${item.slug}` : "/admin/menu"}
          className="rounded-lg border border-hairline px-5 py-2.5 text-sm font-semibold text-body-text transition-colors hover:bg-canvas"
        >
          Cancel
        </Link>
      </div>
    </form>
  );
}
