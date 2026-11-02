import Link from "next/link";
import { ArrowDown, ArrowLeft, ArrowUp, BadgePercent, Eye, EyeOff, Pencil, Plus } from "lucide-react";
import AdminShell from "@/components/admin/AdminShell";
import Card, { CardHeader } from "@/components/admin/ui/Card";
import DeleteButton from "@/components/admin/ui/DeleteButton";
import {
  deleteDealAction,
  moveDealAction,
  toggleDealVisibilityAction,
} from "@/app/admin/(dashboard)/menu/deals/actions";
import { listDeals, listItems } from "@/lib/admin/store";
import { dealWasCents } from "@/lib/deals";
import { formatMoney } from "@/lib/admin/units";
import { fromCents, isSellablePrice, toCents } from "@/lib/money";

export const metadata = { title: "Deals" };
export const dynamic = "force-dynamic";

export default async function DealsPage() {
  const [deals, items] = await Promise.all([listDeals(), listItems()]);

  const nameOf = (slug: string) => items.find((i) => i.slug === slug)?.name ?? slug;
  const priceOf = (slug: string) => {
    const price = items.find((i) => i.slug === slug)?.price;
    return isSellablePrice(price) ? toCents(price) : null;
  };

  return (
    <AdminShell title="Deals">
      <div className="mx-auto max-w-5xl space-y-4 sm:space-y-6">
        <Link
          href="/admin/menu"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted transition-colors hover:text-heading"
        >
          <ArrowLeft size={16} />
          Back to menu
        </Link>

        <Card className="flex items-start gap-3">
          <BadgePercent size={18} className="mt-0.5 shrink-0 text-ember-600" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <CardHeader title="Deals" />
              <Link
                href="/admin/menu/deals/new"
                className="inline-flex items-center gap-1.5 rounded-lg bg-ember-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-ember-500"
              >
                <Plus size={14} />
                Add deal
              </Link>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-muted">
              Dishes sold together for one price. The first deal here leads the homepage and the
              deals page. The site&apos;s deals page and menu link appear once a deal is shown.
            </p>
          </div>
        </Card>

        {deals.length === 0 ? (
          <Card>
            <p className="py-8 text-center text-sm text-muted">No deals yet.</p>
          </Card>
        ) : (
          <Card padded={false}>
            <ul className="divide-y divide-hairline">
              {deals.map((deal, index) => {
                const was = fromCents(dealWasCents(deal, priceOf));
                const saving = was - deal.price;
                return (
                  <li key={deal.slug} className="flex flex-wrap items-center gap-3 px-5 py-4 sm:px-6">
                    <div className="min-w-0 flex-1 basis-64">
                      <p className="font-medium text-heading">
                        {deal.name}
                        {!deal.visible && (
                          <span className="ml-2 rounded-full bg-canvas px-2 py-0.5 text-xs font-medium text-muted">
                            Hidden
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted">
                        {deal.slots
                          .map((s) => {
                            const names = s.itemSlugs.map(nameOf).join(" or ");
                            return s.quantity > 1 ? `${s.quantity} × ${names}` : names;
                          })
                          .join(" + ")}
                      </p>
                    </div>

                    <div className="text-right text-sm tabular-nums">
                      <p className="font-semibold text-heading">{formatMoney(deal.price)}</p>
                      <p className="text-xs text-muted">
                        <span className="line-through">{formatMoney(was)}</span>
                        {saving > 0 ? (
                          <span className="ml-1.5 font-medium text-success">saves {formatMoney(saving)}</span>
                        ) : (
                          <span className="ml-1.5 font-medium text-warn">no saving</span>
                        )}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <form action={moveDealAction}>
                        <input type="hidden" name="slug" value={deal.slug} />
                        <input type="hidden" name="direction" value="up" />
                        <button
                          disabled={index === 0}
                          aria-label={`Move ${deal.name} up`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-heading disabled:opacity-30"
                        >
                          <ArrowUp size={16} />
                        </button>
                      </form>
                      <form action={moveDealAction}>
                        <input type="hidden" name="slug" value={deal.slug} />
                        <input type="hidden" name="direction" value="down" />
                        <button
                          disabled={index === deals.length - 1}
                          aria-label={`Move ${deal.name} down`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-heading disabled:opacity-30"
                        >
                          <ArrowDown size={16} />
                        </button>
                      </form>
                      <form action={toggleDealVisibilityAction}>
                        <input type="hidden" name="slug" value={deal.slug} />
                        <input type="hidden" name="visible" value={String(!deal.visible)} />
                        <button
                          aria-label={deal.visible ? `Hide ${deal.name}` : `Show ${deal.name}`}
                          className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-heading"
                        >
                          {deal.visible ? <Eye size={16} /> : <EyeOff size={16} />}
                        </button>
                      </form>
                      <Link
                        href={`/admin/menu/deals/${deal.slug}/edit`}
                        aria-label={`Edit ${deal.name}`}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-faint transition-colors hover:text-heading"
                      >
                        <Pencil size={16} />
                      </Link>
                      <DeleteButton
                        action={deleteDealAction}
                        hiddenField={{ name: "slug", value: deal.slug }}
                        label={`Delete ${deal.name}`}
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
