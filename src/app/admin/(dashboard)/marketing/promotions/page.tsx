import Link from "next/link";
import { Plus, Tag, Pencil } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import { deletePromoCodeAction } from "@/app/admin/(dashboard)/marketing/promotions/actions";
import { listPromoCodes } from "@/lib/admin/store";
import { formatMoney } from "@/lib/admin/units";

export const metadata = { title: "Promo codes" };
export const dynamic = "force-dynamic";

export default async function PromoCodesPage() {
  const promoCodes = await listPromoCodes();
  const today = new Date().toISOString().slice(0, 10);

  return (
    <AdminShell title="Promo codes">
      <div className="mx-auto max-w-4xl space-y-4 sm:space-y-6">
        <Card className="flex items-start gap-3">
          <Tag size={18} className="mt-0.5 shrink-0 text-ember-600" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardHeader title="Promo codes" />
              <Link
                href="/admin/marketing/promotions/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-ember-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-ember-500"
              >
                <Plus size={14} />
                Add code
              </Link>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Codes customers enter at checkout for a discount. Every
              redemption is re-validated against the live order total, so
              nothing here can be bypassed from the browser.
            </p>
          </div>
        </Card>

        {promoCodes.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-muted">
              No promo codes yet. Add one and it becomes redeemable at
              checkout immediately.
            </p>
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-hairline">
              {promoCodes.map((promo) => {
                const expired = promo.expiresAt != null && promo.expiresAt < today;
                return (
                  <li
                    key={promo.id}
                    className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-display font-semibold text-heading">
                          {promo.code}
                        </p>
                        <StatusPill active={promo.active} expired={expired} />
                      </div>
                      <p className="mt-0.5 text-xs text-muted">
                        {promo.type === "percentage"
                          ? `${promo.value}% off`
                          : `${formatMoney(promo.value)} off`}
                        {promo.minOrder != null &&
                          ` · min. ${formatMoney(promo.minOrder)}`}
                        {promo.expiresAt && ` · expires ${promo.expiresAt}`}
                        {promo.singleUsePerCustomer && " · one use per customer"}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Link
                        href={`/admin/marketing/promotions/${promo.id}/edit`}
                        aria-label={`Edit ${promo.code}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-heading"
                      >
                        <Pencil size={16} />
                      </Link>
                      <DeleteButton
                        action={deletePromoCodeAction}
                        hiddenField={{ name: "id", value: promo.id }}
                        label={`Delete ${promo.code}`}
                        compact
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </div>
    </AdminShell>
  );
}

function StatusPill({ active, expired }: { active: boolean; expired: boolean }) {
  if (expired) {
    return (
      <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-warn">
        Expired
      </span>
    );
  }
  if (!active) {
    return (
      <span className="rounded-full bg-canvas px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-faint">
        Inactive
      </span>
    );
  }
  return (
    <span className="rounded-full bg-success-soft px-2 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide text-success">
      Active
    </span>
  );
}
