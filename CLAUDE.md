# Kebabish — Project Context for Claude Code

Read this first. This is a real client project, not a demo. Follow it precisely.

## ⚠️ Read this before touching any visual design

**The design direction is now agreed with Danish** (see "Design direction
— agreed" below). Work within it. It replaced an earlier attempt at a
"warm terracotta/mustard/maroon" palette and a display typeface that was
picked *without* the client's input — he explicitly rejected that and had
it stripped out.

The lesson stands: **don't invent a new palette, typeface, or visual
direction on your own.** Small tweaks inside the agreed system are fine
and expected. A change of direction is not — ask Danish first, with
specific concrete questions rather than a vague "what do you want".

The same rule applies to anything else you'd otherwise have to guess:
prices, coordinates, opening hours, marketing copy, whether the food is
halal. Ask; don't invent.

## The business

**Kebabish** (trading name / brand) is run by **Marfah Enterprise** (legal
company name), an authentic Pakistani food kitchen in **Hoogkarspel,
Netherlands**. Delivery and takeaway only — there is no dine-in, and that
fact must stay visible/consistent everywhere on the site (nav, footer,
hero, metadata). All real business facts (KVK number, address, phone/
WhatsApp, email, socials, delivery radius) already live in
`src/lib/site-config.ts` — treat that file as the single source of truth,
don't hardcode business details anywhere else.

Owner: Danish. He is non-technical-ish but hands-on, responsive, and wants
to be consulted on design/product decisions before you run with them (see
above). He also wants to eventually manage the menu himself (see admin
dashboard, below).

## Priorities, in order

1. **SEO is the top priority.** This is a local business trying to rank
   for searches like "Pakistaans eten bezorgen Hoogkarspel". Every new page
   needs proper `generateMetadata`, and structured data
   (`src/components/StructuredData.tsx`) should stay accurate as the site
   grows (e.g. add `Menu`/`MenuItem` structured data once prices exist).
2. **Mobile-first.** Most customers will be on their phones. Every UI
   decision — tap target size, sticky header, WhatsApp button placement,
   checkout flow — should be designed for mobile first, desktop second.
3. **Two ordering paths, both must stay easy:** a full on-site cart/
   checkout with online payment, AND WhatsApp click-to-order (currently
   the only working path — see "What's not built yet" below).

## Tech stack (already decided, don't relitigate without asking Danish)

- **Next.js 16** (App Router), TypeScript, Tailwind CSS v4 (CSS-based
  `@theme` config in `src/app/globals.css` — currently empty/neutral, see
  the design note above)
- **next-intl v4** for bilingual routing — Dutch is the default locale
  with no URL prefix (`/menu`), English is prefixed (`/en/menu`). Routing
  config: `src/i18n/routing.ts`, `navigation.ts`, `request.ts`,
  `src/proxy.ts` (Next 16 renamed `middleware.ts` → `proxy.ts` — don't
  rename it back). All UI copy lives in `messages/nl.json` /
  `messages/en.json`, never hardcode user-facing strings in components.
- **Supabase** (Postgres) — planned, not yet wired up. Will back the menu
  data (replacing the static `src/lib/menu-data.ts`) and the admin
  dashboard.
- **Mollie** — planned payment gateway (iDEAL, cards, Apple/Google Pay,
  Klarna). Chosen because iDEAL covers ~70% of Dutch online purchases and
  Mollie is the NL-native provider for it.
- **Google Maps API** — planned, for a delivery-radius check on the
  contact/checkout flow (Distance Matrix API) and a proper embedded map.
  Currently the contact page uses a keyless basic Maps embed as a
  placeholder.
- Hosting target: **Vercel**, domain **kebabish.nl** (already owned, DNS
  access confirmed by Danish).
- All planned service keys have placeholders in `.env.example` — ask
  Danish for real values when you get to that feature, don't invent them.

## Design direction — agreed

Danish supplied the logo (`public/logo/`, light- and dark-background
variants) and these three brand colors, taken from it:

| Token | Hex | Use |
| --- | --- | --- |
| `cream-200` | `#EDE6D0` | page background |
| `charcoal-600` | `#3D3831` | headings, dark sections |
| `ember-600` | `#A95026` | accent — CTAs, eyebrows, hovers |

Body copy sits on a warm near-black (`--color-ink`, `#1a1713`) so it
reads slightly darker than headings. Full scales for all three colors are
defined as Tailwind v4 `@theme` tokens in `src/app/globals.css` — use the
tokens, never raw hex, and never Tailwind's default `neutral-*`.

**Typography:** Bitter (slab serif) for headings via `font-display`,
Inter for body. Bitter was chosen to sit beside the logo's hand-cut serif
wordmark without competing with it — the exact logo typeface is unknown,
so the logo image itself is always used as the brand mark rather than
being set in type. If Danish ever supplies the real font file, swapping
it is a one-line change in `[locale]/layout.tsx`.

**Motion:** GSAP + ScrollTrigger, with Lenis for smooth scrolling on
pointer devices (touch keeps native momentum). All of it lives in one
client island, `src/components/motion/Motion.tsx`; sections stay server
components and opt in with data attributes (`data-reveal`,
`data-reveal-group`, `data-reveal-mask`, `data-parallax`). This keeps
every word of copy in the server-rendered HTML, which matters because SEO
is priority #1. `prefers-reduced-motion` is honoured — everything renders
at its resting state with no animation.

Reveal elements are primed to `opacity: 0` only under `html.js`, and a
`<noscript>` style block in the locale layout unhides them, so the page is
never blank for a crawler or a no-JS reader.

## Admin panel — agreed

Lives at **`src/app/admin/`**, deliberately *outside* the `[locale]` segment
so it never inherits the public chrome (header, footer, WhatsApp button) or
the nl/en URL prefixes. `src/proxy.ts` already excludes `/admin` from the
next-intl middleware, and the admin layout owns its own `<html>/<body>`
(the pass-through root layout allows this). English only, `robots: noindex`.

Danish approved two decisions here:

- **Palette:** white/grey dashboard surfaces (`canvas`, `panel`, `hairline`,
  `heading`, `body-text`, `muted`, `faint` tokens in `globals.css`) with
  **ember as the accent** — the public site's cream is too low-contrast for
  dense tables. Semantic `success`/`warn`/`danger` tokens for statuses.
- **Scope:** adapted to a single kitchen, not the multi-vendor marketplace
  in the reference screenshot — no Riders/Restaurants/Vendor filters.

Components are in `src/components/admin/` (shared primitives under `ui/`,
charts under `charts/`).

**All fake data lives in exactly one file: `src/lib/admin/mock-data.ts`.**
Nothing else under `src/app/admin` or `src/components/admin` invents a
number. Delete that file and point the same exported names at Supabase and
the components don't change. It's generated from a fixed seed, not
`Math.random()` — random values would desync server and client renders and
cause hydration mismatches.

Charts are hand-rolled SVG (`charts/`) — no charting dependency. They're
interactive (hover crosshair + tooltip) and *tween* between states via
`useAnimatedNumbers`, so changing a filter morphs the shape rather than
snapping. CSS can't interpolate an SVG path's `d`, which is why the
underlying values are animated and the path recomputed per frame.

Screens not built yet use `PlaceholderPage` so the nav doesn't 404.

### Auth — NextAuth + Supabase, one /login for both admin and customers

`/login` is the single sign-in page for everyone — staff, owners, *and*
customers. After sign-in, `homeForRole()` in `src/lib/auth.ts` sends the
session to `/admin` (owner/staff) or `/dashboard` (customer). This was a
deliberate ask from Danish: customers get their own accounts and dashboard
view, kept structurally separate from the admin panel, not a role flag
bolted onto the same screens.

**Two separate tables, not one shared `users` table with a role column:**
- `admin_users` (`src/lib/admin/auth-users.ts`) — staff/owner. Only ever
  created by an existing owner, from `/admin/team`. No public sign-up.
- `customers` (`src/lib/customers/accounts.ts`) — self-registered via
  `/signup`. Nothing else about them lives here yet (no addresses, no real
  order history — there's no checkout to generate any).

Mixing these would mean every customer signup landing in the same table
the Team screen calls "who has dashboard access," which is wrong on its
face. `src/lib/auth.ts`'s single Credentials `authorize()` checks
`admin_users` first, then `customers` — whichever matches wins. If the same
email somehow exists in both, the admin account wins; there's no
account-linking, that's an edge case worth knowing about, not one worth
solving pre-emptively.

Route structure (three independent top-level segments, each owning its own
`<html>/<body>` since the root `layout.tsx` is a pass-through — see
`src/lib/fonts.ts` + `src/components/shared/AppShellBody.tsx`, which the
three share so this isn't three copies of the same boilerplate):

- `src/app/(auth)/` — `/login` and `/signup`. A route group so both stay
  at flat top-level URLs; unguarded (they're where an unauthenticated
  visitor is trying to get to).
- `src/app/admin/(dashboard)/` — every staff/owner screen. Its
  `layout.tsx` redirects to `/login` if there's no session, or to
  `/dashboard` if the session is a customer's.
- `src/app/dashboard/` — the customer view. Its `layout.tsx` does the
  mirror-image check: redirects to `/login` if unauthenticated, to
  `/admin` if the session is staff/owner.
- **`src/proxy.ts`'s matcher excludes all of `admin`, `login`, `signup`,
  `dashboard`** from the next-intl locale middleware — miss one of these
  and next-intl will 404 it looking for a `[locale]/thatpath` route that
  doesn't exist. Found this the hard way when `/login` 404'd until the
  matcher was updated to list it explicitly.

Route groups don't affect the URL, but they **do** change the filesystem
import path — anything importing `@/app/admin/menu/actions` etc. needs the
`(dashboard)` segment: `@/app/admin/(dashboard)/menu/actions`.

Sessions are JWT-based, signed with `ADMIN_SESSION_SECRET` (reused rather
than requiring a separate `AUTH_SECRET`). `src/lib/supabase/server.ts` is
the **service-role** Supabase client — server-only (`import "server-only"`),
bypasses RLS entirely, must never be imported into a Client Component.

**Neither table creates itself.** Run `supabase/migrations/0001_admin_users.sql`
*and* `0002_customers.sql` once each in the Supabase SQL editor before using
either flow — nothing in the app runs migrations automatically, and that's
deliberate for a production database. Until they're run, `/login` shows a
"database isn't set up yet" message rather than failing confusingly (see
`countAdminUsers()` — it deliberately avoids a `head: true` count query,
which we found silently swallows a missing-table error from supabase-js
instead of surfacing it).

While `admin_users` is empty, `/login` shows an account-**bootstrap** form
instead of the normal sign-in (creates the first account as `owner`; this
is unrelated to `customers` and doesn't touch that table). Once at least one
row exists, that form is gone for good — new staff accounts after that only
come from `/admin/team` (owner-only), which also handles role changes,
removal, and a self-service change-password form for whoever's signed in.
There's no email-invite flow for staff — an owner sets a temporary password
directly and shares it out of band. Customers, by contrast, always
self-register through `/signup`.

`AdminShell` (`src/components/admin/AdminShell.tsx`) is an async Server
Component that reads the session and hands it to `AdminShellClient` (the
actual interactive chrome, incl. the mobile nav toggle) — this split means
none of the ~20 pages calling `<AdminShell title="...">` needed to change
when auth was added, since the props didn't change. It narrows the
session's role (which also includes `"customer"`) down to `"owner" |
"staff"` before handing it down — safe because the `(dashboard)` layout
guard already guarantees a customer session never reaches this far, but
TypeScript can't see across that boundary on its own.

### "Coming soon" launch gate

`SITE_COMING_SOON=true` in env vars makes the real public site (`/`, `/menu`,
`/contact`, both locales) 307-redirect to `/coming-soon` for everyone —
`/admin`, `/login`, `/signup` and `/dashboard` are entirely unaffected, so
Danish can keep managing menu data while the public site is gated. Flipping
it back to `false` (or removing it) and redeploying is the whole launch
switch — no code change needed either direction. `src/lib/site-gate.ts` is
the single place that reads the flag; `src/proxy.ts`, `robots.ts` and
`sitemap.ts` all defer to it so the three can't disagree.

**Special preview links**, per Danish's request — he wanted a way to show
the real site to people (or himself) while it's gated. Any page URL +
`?preview=<COMING_SOON_PREVIEW_SECRET>` grants a 90-day httpOnly cookie to
that browser that bypasses the gate entirely; the token is stripped from
the URL on the redirect that sets it, so it doesn't linger in the address
bar or browser history. Verified against a wrong token: still gates
normally, no partial-match leakage.

`[locale]/(site)/` is a route group holding the normal chrome'd pages
(Header/Footer/WhatsAppButton, split into `(site)/layout.tsx`);
`[locale]/coming-soon/` sits outside it as a sibling, sharing only the
parent `[locale]/layout.tsx`'s `<html>`/`<body>`/fonts/`NextIntlClientProvider`
— it deliberately has no nav, since links to gated pages would just bounce
back and look broken.

`src/proxy.ts`'s matcher has to explicitly exclude every locale-independent
top-level route (`admin`, `login`, `signup`, `dashboard`) from the next-intl
middleware — miss one and next-intl 404s it hunting for a
`[locale]/thatpath` that doesn't exist. Found this the hard way when
`/login` briefly 404'd before `login`/`signup`/`dashboard` were added
alongside the pre-existing `admin` exclusion.

### Persistence — read this before touching the store

Everything under `/admin/menu` is **fully functional CRUD** via server
actions, writing through `src/lib/admin/store/`:

- `types.ts` — backend-agnostic domain model + the `StoreAdapter` interface.
- `supabase-adapter.ts` — **the production store.** One JSONB document row
  (`store_document`, migration 0003). `StoreAdapter` is a whole-document
  read/write interface, so a document row satisfies it exactly and the ~40
  functions in `index.ts` never had to become SQL. At one kitchen and ~25
  dishes the whole document is a few KB.
- `json-adapter.ts` — fallback only: no Supabase keys (fresh clone, CI), or
  `STORE_ADAPTER=json` in `.env.local`. **Set that when developing**, or
  `npm run dev` edits the real shop's live menu. It can never be the
  production store — Vercel's filesystem is read-only at runtime.
- `index.ts` — the repository, and the single place the backend is chosen.

Known limitation, inherited from the JSON file: writes are last-write-wins,
so two staff saving different screens at the same instant loses one edit.
Fine at this team size; revisit with a version column if it grows.

**Orders are not in the document** — they get real columns (migration
0004): they grow without bound and `/admin/orders` filters and sorts them.
Line items snapshot name/price/options so past orders keep saying what the
customer actually agreed to pay, and all money is integer cents because it
feeds a payment provider.

`getPublicSettings()` is what the storefront calls: it falls back to seeded
defaults if the store is unreachable, because a database hiccup taking
kebabish.nl down is worse than serving default hours. The admin panel keeps
using `getSettings()` and fails loudly — that's how a missing migration
gets noticed.

**The public site still reads the static `src/lib/menu-data.ts`** for
dishes/prices/categories — admin menu edits do NOT yet appear on
kebabish.nl. Wiring the public menu pages to the store was deliberately
deferred: they're statically generated for SEO (priority #1) and should
move to ISR/revalidation at the same time as the Supabase swap, not
before.

**Settings are the one exception — the public site already reads these
live** (see "Live open/closed status" below). Same JSON-adapter caveat
applies (Vercel's read-only filesystem), it's just a much smaller surface
than the full menu, so it was wired ahead of the Supabase swap rather than
waiting for it.

Validation is zod schemas in `src/app/admin/(dashboard)/menu/actions.ts`,
shared by create and update paths. Deletes are guarded server-side — a
category with items or an ingredient used by a recipe refuses, and the
reason surfaces inline in the UI.

### Live open/closed status on the public site

`src/lib/store-status.ts`'s `getStoreStatus()` combines the owner's
"Taking orders" toggle with today's opening hours (from `getSettings()`)
to decide whether the site is actually open right now — always computed
in `Europe/Amsterdam`, not the visitor's own timezone, since the kitchen's
hours don't move with whoever's looking. Closed = the toggle is off, OR
today is marked closed, OR the current time falls outside today's
opens/closes window.

Every ordering affordance on the public site reads this and reacts:
`WhatsAppButton` (floating button) hides entirely when closed; `Header`'s
CTA and the Hero/FinalCta WhatsApp links swap to a disabled-look "Closed
now" state; every per-dish "Add" button (`MenuItemCard`, homepage
`FeaturedDishCard`) swaps to "Currently unavailable". `StoreStatusBanner`
sits between the header and page content on every normal page: a firm
notice when closed (the owner's custom `orderNotice` text if set, else a
generic line), or a lighter one when open but a notice is set anyway
(e.g. "busy tonight, delivery up to 60 min"). `/contact` also renders the
real per-day hours table and a live open/closed pill, and
`StructuredData.tsx` feeds the same hours into schema.org
`openingHoursSpecification` for local SEO.

`(site)/layout.tsx` fetches settings once per request and revalidates
every 60s (`export const revalidate = 60`) since hours can flip on their
own at a hours boundary without anyone touching `/admin/settings`; saving
there also calls `revalidatePath("/", "layout")` / `revalidatePath("/en",
"layout")` for an immediate update instead of waiting on that window.

**A real bug was found and fixed here, worth knowing about:** the
per-day opening-hours inputs in `SettingsForm.tsx` used to be
`disabled={entry.closed}` when a day was marked closed. Disabled fields
are excluded from `FormData` on submit — since `settings/actions.ts` zips
`hourDay`/`hourOpens`/`hourCloses` back together by array *position*, not
by day value, marking any day closed silently shifted every later day's
saved hours by one (Monday is closed by default, so this was live from
the start). Fixed by using `readOnly` instead of `disabled` — the grayed
look was already CSS opacity on the wrapper, not the `disabled` attribute,
so nothing about the UI needed to change, only the submit behavior. If
you ever touch that form again: don't reach for `disabled` on a field
whose value still needs to reach the server.

### Toasts (status messages)

`ToastProvider` wraps the admin layout; fire one with `useToast()`. Bottom-
right on desktop, full width at the bottom on mobile. Auto-dismiss, longer
for errors, pauses on hover, `aria-live="polite"`.

**Actions that `redirect()` can't fire a toast directly** — the navigation
tears down the client first. Those use `flashRedirect()` from
`src/lib/admin/flash.ts` to append `?flash=…&kind=…`, and `FlashToast` shows
it on arrival then strips the params so a refresh doesn't replay it. Use
that helper for any new redirecting action rather than reinventing it.

### Media library

`/admin/media` plus a shared picker. Files upload to a public Supabase
Storage bucket (`media`, created via the Storage API, 6MB/image cap and
mime-type restricted at the bucket level too — not just in the action);
metadata lives in the store. `next.config.ts` allow-lists `**.supabase.co`
in `images.remotePatterns` so `next/image` will render the URLs, and
raises the server action body limit to 12MB for the upload itself.

**This used to write to `public/uploads`**, which is why every upload
failed with `ENOENT: no such file or directory, mkdir '/var/task/public/
uploads'` in production — Vercel's filesystem is read-only at runtime, so
the directory can never be created there even though it works locally.
Storage uploads don't touch the filesystem at all, so this is fixed for
good, not just papered over.

Note this means uploads always hit the real Supabase bucket, **even in
local dev with `STORE_ADAPTER=json`** — that override only affects the
menu/settings document, not media. Uploading a test image locally puts a
real file in the live bucket; delete it afterwards the same way any other
QA leftover gets cleaned up.

- `ImageField` — single featured image (categories).
- `GalleryField` — ordered gallery (menu items). **The first image is the
  featured one**; that's the entire rule, which is why reordering is the way
  you change the feature rather than a separate toggle. Native HTML5 drag and
  drop, with arrow buttons as the keyboard-accessible fallback.
- Deleting an image detaches it from every item/category that referenced it,
  so no dangling ids. It warns first, and needs a second confirm if in use.
- Image dimensions are measured in the browser and sent with the upload —
  reading them server-side would mean an image-decoding dependency for nothing.

### Extras (option groups)

Reusable groups of add-ons — sauces, drinks, toppings — managed at
`/admin/menu/extras` and attached to dishes by id, so repricing a sauce is
one edit rather than twenty. `minChoices`/`maxChoices` drive whether the
customer sees radios or capped checkboxes. **Seeded empty**: what the
extras are and what they cost is Danish's to fill in, not ours to invent.

The option rows submit as a single JSON field, not parallel
`optionLabel[]`/`optionPrice[]` inputs — see the opening-hours bug below
for why positional zipping of FormData arrays is a trap.

### The delivery-area map

`src/lib/map-projection.ts` holds the shared centre/zoom/size and the Web
Mercator maths. The homepage graphic layers brand pins over a Google
Static Maps image, and they only line up because both are computed from
those same constants — so **don't change one without the other**.

Town coordinates in `siteConfig.deliveryAreaTowns` are real (geocoded),
not art-directed: a made-up coordinate now visibly lands in the wrong
field. Pins are therefore fixed, which means *labels* are the only thing
free to move — `placeLabels()` tries each corner until a label neither
leaves the canvas nor collides, because Lutjebroek/Grootebroek/
Bovenkarspel sit at nearly the same latitude and would otherwise stack.

The map image is a plain `<img>`, and a failed request (bad key, quota)
can error before React hydrates, so `onError` alone misses it — the
mount-time `complete && naturalWidth === 0` check is what actually
triggers the illustrated fallback.

**Wognum is 10.34km from the kitchen**, just outside the advertised 10km
radius, so its pin renders outside the ring. Flagged to Danish; kept
because it's already advertised.

### Cart and checkout

The public menu now reads the store (`src/lib/public-menu.ts`), so prices,
sold-out flags and extras that Danish sets in `/admin` appear on the site.
Same resilience rule as settings: it degrades to seeded content rather than
taking the storefront down.

The cart is `localStorage` only (`CartProvider`). **Nothing it says about
money is trusted.** `priceCart()` in `src/lib/orders.ts` throws away every
submitted price and rebuilds each line from the store, re-checking that the
dish exists, isn't sold out, has a price, that each chosen option belongs
to a group actually offered on that dish, and that required groups were
satisfied. A hand-edited cart can change *what* someone orders, never
*what they pay*. Delivery fee, free-delivery threshold, minimum order and
whether we deliver to that town are all recomputed server-side too.

A dish with `price: null` can't be added at all — the cart would carry a
line it can't total. Those fall back to WhatsApp, which is how they're
ordered today anyway.

Money is integer cents from the moment it leaves the cart. Order lines
snapshot name, price and chosen options, so editing the menu later never
rewrites what a past customer agreed to pay.

**Payment (Mollie).** `src/lib/mollie.ts` is a two-call REST client, no SDK.
The flow: checkout action prices the cart → writes the order → creates a
payment → redirects to Mollie. Status comes back two ways, because either
can arrive first: the webhook (`/api/mollie/webhook`) and the return page,
which polls if the order is still `open`. Mollie's webhook posts only a
payment id — the status is then fetched with our own key, so a forged POST
can't mark an order paid.

Two things that bit us and are easy to reintroduce:
- **Return URL must follow the request origin**, not
  `NEXT_PUBLIC_SITE_URL` — otherwise a developer testing locally gets
  redirected to the live site after paying. It also needs the locale
  prefix, or an English customer lands on the Dutch confirmation.
- **Mollie rejects non-public webhook URLs**, so local dev omits the
  webhook entirely and relies on the return page polling. That's why the
  page reconciles rather than trusting the webhook alone.

Verified end to end against Mollie test mode: extras priced correctly,
required choices enforced, minimum-order and free-delivery thresholds
applied, order and line items persisted, payment marked paid, cart
cleared. The test order was deleted afterwards.

### Dashboard, orders, customers, reports — all real now

There is no more mock data anywhere in the admin panel. `mock-data.ts` is
deleted; everything it used to fabricate now comes from the real `orders`,
`order_items` and `customers` tables (see "Cart and checkout" above for
why those exist).

- `src/lib/admin/order-types.ts` — the real domain vocabulary (statuses,
  channels, labels) that survived the migration. Not fake data, just
  shared types — kept separate from the data itself.
- `src/lib/admin/orders-data.ts` — `"server-only"`. Every fetch (orders,
  customers, notifications) hits Supabase with the service-role client,
  which can never reach a Client Component. Pages fetch once and pass the
  plain array down as a prop.
- `src/lib/admin/order-analytics.ts` — pure functions, no Supabase calls.
  Dashboard and Reports fetch the full order list server-side *once* and
  pass it down; every dropdown (period, status, metric) recomputes from
  that already-fetched array client-side, so switching one still tweens
  instantly with no round-trip — same UX the mock version had, now over
  real orders.

Known, documented approximations rather than invented numbers:
- **Customer status** ("new"/"active"/"lapsed") is derived: no orders yet
  = new, ordered within 60 days = active, older = lapsed. A judgement
  call, not a stored fact — revisit the threshold if it stops feeling
  right.
- **Sales by category** matches each order line's snapshotted dish
  against *today's* menu to find its category (order lines don't
  snapshot a category, only the dish). A dish that's moved category
  since, or been deleted, reports under its current category or "Other".
- **Ordering channel** will read 100% Website until WhatsApp orders get
  a logging path of their own — a WhatsApp order is a chat message, not
  a database row, so there's nothing to report yet. This reports what's
  actually tracked, not a guess.
- **Notifications** only cover the one real signal that exists — new and
  cancelled orders. The mock version invented "low stock" and "new
  review" notifications with no system behind either; those are gone
  rather than faked.

Since Kebabish just launched, real order volume is near zero — the
dashboard and reports will show mostly zeros until real orders come in.
That's correct, not broken.

Verified end-to-end against a real Mollie-paid test order (not a
fixture — an actual checkout run through test-mode payment): appeared
correctly in the orders list, quick view, and full detail page; the
linked customer's profile showed the right lifetime value, favourite
dish, address (pulled from the delivery order, since customers carry no
address of their own), and status; the dashboard's summary stats, order
analytics chart and activity feed all picked it up; reports correctly
attributed it to Main Dishes, Hoorn, and the website channel. Test order
and accounts deleted afterward — confirmed via the database that a real
customer who'd already signed up independently (unrelated to this
testing) was left untouched throughout.

### Allergens are user-extendable

`Allergen` is a plain string, not a union. The 14 EU-mandated ones seed the
store flagged `statutory: true` — renameable but not deletable. Danish can add
his own at `/admin/menu/allergens`.

### The menu editor — one page per dish, WordPress-style

`/admin/menu/items/new` and `/admin/menu/items/[slug]/edit` are now the
single place a dish gets managed: name, price, variants, gallery, extras
and (once the dish exists) its recipe in the wide left column; category,
manually-flagged allergens, tags and status (visible/vegetarian/spicy/
sold-out) in the narrow right sidebar — the WordPress post-editor layout,
because that's a well-worn pattern for "one thing, its content, and its
metadata."

This replaced a flow where clicking any dish from `/admin/menu` landed on
`/admin/menu/recipes/[slug]` — a recipe-only page with no visible name,
price, category or photo — and creating a new dish bounced you to *that*
same recipe-only screen before you could see the dish you'd just made.
`createItemAction`/`updateItemAction`/`saveRecipeAction` all redirect to
the unified edit page now; `/admin/menu/recipes/[slug]` still exists as a
deliberately separate **view**, for the cost/margin breakdown and the
batch calculator — it's a different task (costing a dish you already
know) from editing one, and now also shows the dish's own name, category,
price and photo at the top rather than assuming you already know them.

**Two `<form>`s share one page, not one giant form.** Dish details and
the recipe save independently — different server actions, different
data — but the *sidebar* fields (category, allergens, tags, status) are
visually outside the main dish-details `<form>` while still needing to
submit with it. They're linked via the HTML `form="item-form"` attribute
rather than being physically nested inside it. Get this wrong — inputs
sitting outside the form with no `form` attribute — and they silently
don't submit at all; this was caught and fixed during testing, verified
by checking the saved record afterward, not just that the page redirected.

Two fields exist only for this editor and aren't consumed anywhere else
yet: `StoredItem.tags` (free-form, comma-separated, admin-side only —
not a public filter) and `StoredItem.allergenIds` (manually flagged,
separate from a recipe's own auto-rolled-up allergens from its
ingredients — a dish can be flagged before its recipe exists).

**`StoredItem.visible`** is the new "show on website" flag, separate
from `soldOut` (a sold-out dish still shows, marked unavailable; an
invisible one is a draft that doesn't appear at all). `getPublicMenu()`/
`getPublicItem()`/`getPublicItemSlugs()` in `public-menu.ts` all filter
on it. `/admin/menu` is a proper filterable table now (search, category,
shown/hidden) instead of a card-per-category list, with an inline toggle
button (`toggleItemVisibilityAction`) that flips it without opening the
full editor — verified end-to-end: toggling to "Hidden" in the table
immediately dropped the dish from the live `/menu` page.

### Menu wiped to a blank slate

Danish's ask, verbatim: *"I DONT NEED THEM, i need a blank slate to add
myself."* All categories, items, recipes and ingredients were cleared
from the live Supabase document — including his own test entries
(Chicken Biryani's price, "Vegetable Rice", "NEW DISH"), confirmed
explicitly rather than assumed. **The 14 EU-mandated allergens were kept**
(the whole list already was statutory, so nothing to filter), and so was
his real "Sauces" extras group — extras were never part of this ask, and
that group has a real price he set himself, not a leftover.

If anything needs restoring, the pre-wipe document was saved to this
session's scratchpad before deleting — ask Claude Code to check its
memory/history for the backup rather than assuming it's gone for good.

### Menu & recipe system

Built under `/admin/menu`: items by category, category management,
ingredient library, per-dish recipe pages, and a production planner.

Data lives in `src/lib/admin/` — all of it **placeholder**, all of it
destined for Supabase:

- `ingredients.ts` — ingredient library. Cost per purchase unit drives
  every food-cost figure in the panel; **the prices are invented** and
  must be replaced with real supplier pricing before any margin number
  is trusted. Carries the 14 EU-declarable allergens per ingredient.
- `recipes.ts` — per-dish recipes keyed to `menu-data.ts` slugs, with
  portion weight, batch yield, ingredient lines, prep/cook time, method.
- `recipe-math.ts` — **all arithmetic, as pure functions.** Scaling,
  costing, allergen roll-up, and multi-dish aggregation live here, not in
  components, so the numbers stay testable.
- `units.ts` — metric only (g/kg/ml/l/pcs). Never mix unit systems in a
  costing tool.

Two things worth knowing about the maths:

- **Yield is derived, never stored** — plated weight ÷ raw input weight.
  It re-checks itself when a quantity changes, so it can't drift out of
  sync with the recipe. Packaging is excluded from the food-weight sum.
- **Cost returns 0 rather than guessing** when a line's unit dimension
  doesn't match how the ingredient is purchased (e.g. millilitres against
  a per-kilo price). Don't "fix" this by inventing densities.

## What's already built (functionally working, committed to git)

- Bilingual routing/middleware, full site chrome (`Header`, `Footer`,
  `WhatsAppButton`)
- Homepage, `/menu` (all 6 categories, every dish from the finalized
  menu list), `/contact` (address, hours, socials, embedded map)
- SEO plumbing: `sitemap.ts`, `robots.ts`, per-page metadata, hreflang
  alternates, `FoodEstablishment` JSON-LD
- WhatsApp ordering: floating button site-wide + per-dish "Add" button
  that opens a pre-filled WhatsApp message
- Live open/closed status site-wide, driven by `/admin/settings` (see
  "Live open/closed status on the public site" above) — every ordering
  CTA and a site banner react to the real Taking Orders toggle, hours,
  and notice text

The homepage now also has its full visual design applied (see "Design
direction — agreed"): a video-ready hero, a scrolling selling-points
marquee, the story section, featured dishes, a "why Kebabish" band, a
delivery-radius diagram, and a closing CTA.

## What's NOT built yet — priority order

1. **Get it running.** `npm install` had a peer-dependency conflict
   (next-intl v3 doesn't support Next 16) — already fixed (bumped to
   `next-intl@^4.14.1`, renamed `middleware.ts` → `proxy.ts`). Run
   `npm install` fresh, then `npm run dev`, and fix anything else that
   surfaces.
2. ~~Have the design conversation~~ — **done.** The agreed direction is
   applied to the **homepage** and the shared chrome (header, footer,
   WhatsApp button, `MenuItemCard`). The `/menu` and `/contact` page
   bodies inherit the palette and typography but haven't had a dedicated
   design pass yet — that's the next styling job.
3. ~~Hero background video~~ — **done.** Two variants, not one:
   `public/video/hero-web.mp4` and `hero-mobile.mp4`, swapped via CSS
   breakpoint rather than both loading and one being hidden.
   `src/lib/hero-video.ts` checks for each independently at build time,
   so either alone still works (used for both breakpoints) if the other
   is ever missing. Also fixed in passing: `public/favicon.ico` never
   actually existed, so the site had no working tab icon at all —
   `[locale]/layout.tsx` now points at Danish's real
   `public/logo/favicon-kebabish.png` instead.
4. **Real food photography.** Everything in `public/images/` is a Pexels
   placeholder (see `public/images/CREDITS.md`). Replacing a photo is a
   file drop at the same path.
5. **Menu prices.** `src/lib/menu-data.ts` has every dish with `price:
   null` — Danish never provided prices. The UI shows "price on request"
   as a fallback. Ask him for the price list.
6. ~~On-site cart + Mollie checkout~~ — **done.** See "Cart and checkout".
   Still on the **test** Mollie key: going live is swapping
   `MOLLIE_API_KEY` for the `live_…` one, no code change. WhatsApp
   ordering still works alongside it.
7. ~~Admin dashboard~~ — **done**, and now Supabase-backed.
8. **Google Maps delivery-radius check** on the contact/checkout flow.
   ⚠️ `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is currently **invalid** — it
   starts `Alza`, and every real Google key starts `AIza`. Geocoding and
   the static map both 403 until Danish re-copies it. The delivery map
   falls back to its illustration meanwhile.
9. ~~Geocode the real kitchen coordinates~~ — **done.** Danish supplied
   them directly; `siteConfig.coordinates` is now the real address.
10. **Decide on Wognum.** Town coordinates are now geocoded and real, and
    Wognum measures 10.34km straight-line — outside the advertised 10km
    radius, and driving distance is further still. Every other town is
    comfortably inside. Danish needs to either drop it or widen the stated
    radius.
11. **Menu prices.** Danish is adding them via `/admin`. Until then the
    cart and checkout have nothing to total.
12. **Bilingual category labels.** Category names still come from
    `messages/*.json`, so they switch language; once categories are fully
    admin-managed they'd be whatever Danish typed, in one language. He's
    parked this ("currently it's fine") — revisit before the menu moves
    fully off the static file.

## Working style Danish expects

He wants to be consulted before design and architectural decisions, and
reacts strongly (rightly) when something is decided for him without being
asked — see the design section above for exactly why that section exists.
Within an agreed direction he's comfortable with you moving fast. He's
engaged and responsive — if something is ambiguous, or you're about to
invent business data (prices, coordinates, copy) or a design choice he
hasn't actually given you, stop and ask rather than guessing.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
