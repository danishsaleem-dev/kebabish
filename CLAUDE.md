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
Netherlands**. **Delivery only** — no dine-in, and no pickup/takeaway
either (Danish confirmed explicitly: he does not offer customer pickup,
so don't reintroduce it). That fact must stay visible/consistent
everywhere on the site (nav, footer, hero, metadata, checkout — there is
deliberately no fulfilment choice at checkout, every order is delivery).
"Marfah Enterprise" itself is only ever named on the Privacy Policy and
Terms & Conditions pages, where the legal entity name is expected —
nowhere else on the public site. All real business facts (KVK number,
address, phone/WhatsApp, email, socials, delivery radius) already live in
`src/lib/site-config.ts` — treat that file as the single source of truth,
don't hardcode business details anywhere else.

Owner: Danish. He is non-technical-ish but hands-on, responsive, and wants
to be consulted on design/product decisions before you run with them (see
above). He also wants to eventually manage the menu himself (see admin
dashboard, below).

## Priorities, in order

1. **SEO is the top priority.** This is a local business trying to rank
   for searches like "Pakistaans eten bezorgen Hoogkarspel". Every new page
   needs proper `generateMetadata`, built with `pageMetadata()` from
   `src/lib/seo.ts` (it sets title, description, canonical/hreflang **and**
   Open Graph/Twitter — see "SEO audit and structured data" below for why
   a page must not hand-roll these). Structured data lives in
   `src/components/StructuredData.tsx` and `src/components/schema/`, and
   should stay accurate as the site grows.
2. **Mobile-first.** Most customers will be on their phones. Every UI
   decision — tap target size, sticky header, WhatsApp button placement,
   checkout flow — should be designed for mobile first, desktop second.
3. **Two ordering paths, both must stay easy:** a full on-site cart/
   checkout with online payment, AND WhatsApp click-to-order.
   **The on-site checkout is the primary path now** (Oct 2026, Danish's
   call): every **"Order now" / "Nu bestellen"** button — the desktop
   header, the mobile menu, the contact page — is a plain link to
   `/menu`, not a `wa.me` link, and carries a shopping-bag icon rather
   than the chat bubble. WhatsApp is still there as the *conversation*
   route (the floating button, "WhatsApp us" on the homepage FAQ and
   final CTA, "Ask on WhatsApp" on Delivery areas, "Discuss it on
   WhatsApp" on Catering, the error page, the coming-soon page, and a
   dish that has no price yet) — don't turn those into menu links
   without asking, and don't turn "Order now" back into WhatsApp.

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

There are no placeholder screens: Messages, Campaigns, Marketing and Support were empty "coming soon" pages with nothing behind them and were removed (Oct 2026) rather than left in the nav to suggest features that don't exist. Promo codes (`/admin/marketing/promotions`) is the one real marketing screen and is a top-level sidebar link; `/admin/marketing` redirects to it. Build a real screen when there is a real feature, don't add a stub.

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
Storage bucket (`media`, created via the Storage API, mime-type restricted
at the bucket level too — not just in the action); metadata lives in the
store. `next.config.ts` allow-lists `**.supabase.co` in
`images.remotePatterns` so `next/image` will render the URLs, and raises
the server action body limit to 40MB (several 10MB originals can go up in
one batch — see below).

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

**Every upload is re-encoded through `sharp` before it ever reaches
storage** (`uploadMediaAction` → `optimiseImage`): resized to fit inside
2400×2400 (never enlarged — a small source passes through at its own
size) and converted to WebP at quality 82, regardless of the input
format. A phone photo straight off a camera is routinely 3-5MB at
4000px+; nothing on the site ever displays a dish photo wider than
~1200px, so this cuts storage size by 90%+ with no visible loss, and does
it once here rather than repeatedly on every request. Accepts JPEG, PNG,
WebP or AVIF in, up to 10MB each — always writes `.webp` out. Width/
height stored on the record are sharp's real post-resize output, not the
original's — there's no reason to measure dimensions in the browser
anymore now that the server decodes the image anyway, so `MediaUploader`
doesn't.

- `ImageField` — single featured image (categories).
- `GalleryField` — ordered gallery (menu items). **The first image is the
  featured one**; that's the entire rule, which is why reordering is the way
  you change the feature rather than a separate toggle. Native HTML5 drag and
  drop, with arrow buttons as the keyboard-accessible fallback.
- Deleting an image detaches it from every item/category that referenced it,
  so no dangling ids. It warns first, and needs a second confirm if in use.

### SEO & structured data

**Every page under `[locale]/(site)` sets its own `alternates`.** This
looks redundant with the root `[locale]/layout.tsx`'s `alternates` at
first glance, but it isn't optional: Next's metadata resolution has a
child page *inherit* the parent's `alternates` verbatim if the child
doesn't set its own, and the root layout's only ever describes the
locale *root* ("/" or "/en"). Before `src/lib/seo.ts`'s
`localeAlternates(locale, path)` existed, every single page on the site
— `/menu`, `/about`, every dish — was silently telling Google its
canonical URL was the homepage. Any new page's `generateMetadata` needs
`alternates: localeAlternates(locale, "/whatever-the-path-is")`, checkout/
cart included even though those are `noindex` (cheap correctness, and a
safety net if the noindex is ever removed by mistake). The one exception
is `checkout/complete` — it's per-order via a `?ref=` query param, so
there's no single canonical URL to claim, and it's `noindex` anyway.

Structured data is split by concern rather than one giant block:
- `StructuredData.tsx` — the site-wide `FoodEstablishment` (name,
  address, hours, delivery radius, an `OrderAction`, real `paymentAccepted`
  from Mollie's methods, `logo`/`image` — see "SEO audit" below for why
  `hasDeliveryMethod` is gone). Rendered once in `[locale]/layout.tsx`, so it's on
  every page — that's expected, same as a footer address. Also carries
  `aggregateRating`/`review` for the whole business, but **only when
  there are actually reviews (Website content → Reviews, `getReviews()`)** — a rating with
  nothing behind it is exactly what Google's review-snippet guidelines
  penalise, so this stays entirely absent (not zeroed, absent) until
  Danish supplies real reviews. No code change needed when he does; it
  activates on its own.
- `MenuStructuredData.tsx` — `Menu`/`MenuSection`/`MenuItem`, only on
  `/menu`, built from the same `getPublicMenu()` data the page itself
  renders. A dish with no price yet ships without an `offers` block
  rather than inventing one; sold-out is `offers.availability:
  SoldOut` rather than looking orderable.
- `BreadcrumbSchema.tsx` — on every page except the homepage. Always
  prepends Home so callers just pass their own page's trail.

**Favicons.** `src/app/favicon.ico` was still the literal
`create-next-app` placeholder (the generic Next/Vercel triangle) —
Next's file-convention system auto-serves whatever's at that exact path
and injects its own `<link rel="icon">` for it, *regardless* of what
`metadata.icons` says, so it was silently outranking the real icon in
some browser contexts (bookmarks, tab icon in particular) this whole
time. `scripts/generate-favicons.mjs` is the fix — a one-off (not part
of the build) that renders `public/logo/favicon-kebabish.png` down to
every size actually needed (16/32/48 for the browser, 180 for Apple
touch — flattened onto solid charcoal since iOS handles transparency
oddly, 192/512 for `public/site.webmanifest`) and hand-assembles a real
multi-image `favicon.ico` (ICONDIR container, PNG-in-ICO — every modern
browser supports that, and there's no ICO encoder in the dependency
tree to reach for instead). Re-run it if the source mark ever changes;
nothing regenerates these automatically.

**Social preview image.** `public/og-image.jpg` didn't exist —
`StructuredData.tsx`'s `image` field and the `openGraph`/`twitter` tags
in `[locale]/layout.tsx` were pointing at a 404, so any link shared on
WhatsApp/social had no preview card at all. `scripts/generate-og-image.mjs`
renders one from an inline SVG (brand gradient, the logo mark, real
tagline/copy) — also a one-off, rendered once and committed as a static
JPEG rather than generated at request time, specifically so it never
depends on font availability on whatever machine ends up building the
site.

### Backups (free-plan substitute)

The Supabase project is on the **free plan, which has no backups at all**, while orders and
invoices must be kept for seven years. So there is a manual export: **Settings → Backup**
(`/admin/settings/backup`, **owner only**) downloads one JSON file of everything; the owner does
it weekly. It is a stopgap, not point-in-time recovery — up to a week of orders could be lost, and
the page says so and recommends **Supabase Pro (~$25/month, daily backups)** once orders flow, keeping
this export as a second copy outside Supabase.

- **`src/lib/backup/export.ts`** — `BACKUP_TABLES` lists all 14 tables **in dependency order** (a
  row is restored after the rows it points at) with each table's primary key. The file carries
  each table's `pk`, `omit` and `restoreDefaults` inside it, so the restore script is generic and an
  old file stays restorable if this list later changes. **Add any new table to `BACKUP_TABLES`** when
  you write a migration — nothing else will remind you.
- **Deliberately excluded:** **password hashes** (`customers`, `admin_users`) are dropped
  server-side and never serialised — a backup file gets copied to laptops and drives, and a leaked
  one must not be a bag of crackable credentials. Cost: after a restore everyone uses "forgot
  password". Also excluded: the **uploaded photos/videos** (Supabase Storage; the records and URLs
  are in the file, the bytes are not — keep the originals) and all secrets (env vars, never in the DB).
  The file *does* hold names, addresses, phone numbers and emails, i.e. GDPR personal data: the page
  says so, the download is `Cache-Control: no-store`, and `kebabish-backup-*.json` is git-ignored.
- **Access:** page = `requireRole(["owner"])`; download = a route handler, so the role is checked
  by hand (401 for everyone else, including staff — they have no need for a copy of every customer
  they can take off the premises). The sidebar link is hidden from non-owners.
- **The weekly nudge:** the download records `settings.lastBackupAt` / `lastBackupRows` (written by
  the download itself, never the settings form, so saving settings can't wipe them). The owner's
  dashboard shows a one-line banner when the last backup is **more than 7 days old — but only once
  there is a paid order** (before launch there is nothing to lose, and an always-on banner is one people
  learn to ignore). The page itself shows green/amber status.
- **Restore: `node scripts/restore-backup.mjs <file> [--apply] [--only=a,b] [--allow-nonempty]`.**
  Dry run by default; it prints the target project, the rows in the file vs the target, and writes
  nothing. First run every migration in `supabase/migrations/` in the target (it restores rows, not
  tables). It **refuses to touch a non-empty database** without `--allow-nonempty`, because a restore
  is an upsert and would put the backup's older values over newer ones — prefer a new empty project.
- **How omitted password columns are handled, and a bug the test caught:** rows are first inserted
  with an unusable placeholder (`!restored-reset-your-password`) using `ignoreDuplicates`, so an
  existing row — and its real hash — is never touched. The "bring columns up to date" step for those
  tables is a per-row **UPDATE, not an upsert**: Postgres checks a NOT NULL column on the *proposed*
  row before it looks for the existing one, so an upsert that omits the hash fails even for rows that
  exist (the first version of the script did exactly that).
- **Verified (Oct 2026) against the live database:** a full export → restore → re-export of all 12 (the original set; `site_content` and its history joined later)
  tables is byte-for-byte identical (the only difference is the last-backup stamp the export itself
  writes); a deleted customer + order + line item came back field-for-field (accented text, JSON
  options, the customer link, the original timestamp) with the placeholder password; the real
  password hashes were fingerprinted before and after and did not change; a non-empty target and a
  junk file are both refused; no hash, key or secret appears anywhere in the file.
- **Not built:** automatic scheduled backups (the plan is a human downloading weekly), encryption of
  the file, and backing up the Storage files.

### Customer feedback (migration `0018_feedback.sql`)

A public form at **`/feedback`** (both locales), a table, an admin screen, and prompts in the
places a customer is already looking. Run the migration before relying on it — but note the code
is built to **degrade, not fail, without it**: the form says it couldn't save (and the log says
"run migration 0018"), the dashboard/order-page lookups return "no feedback", and the admin page
shows a "table isn't set up" card. Every read in `src/lib/feedback/data.ts` swallows a missing
table for exactly this reason; only `insertFeedback` reports it.

- **The questions live in code, not the database** (`src/lib/feedback/questions.ts`): eight
  1–5 statements in three sections (food: fresh/taste/value; delivery: ontime/correct/courier;
  website: easy/menu), one required "would you recommend" (`recommend`), a "how did you find us"
  choice, a free comment, and a dish picker (+ "which was your favourite"). Wording is in
  `messages/*.json` under `feedback.questions.*`. Answers are stored as JSON keyed by question
  id, so **adding or retiring a question never needs a migration** — add it to `SCALE_QUESTIONS`
  and the messages; an old row just lacks the key. `recommend` is also its own column because it
  is the number everything sorts and alerts on.
- **Why steps, and why only one required question:** nine ratings on one screen read as a
  survey and get abandoned; the same nine as four short steps read as quick taps. A tired
  customer who skips a question is still worth hearing from, so only `recommend` is required. A
  visitor who answers "not yet" to "have you ordered?" skips food and delivery entirely. The
  scale is a real radio group (arrow keys, "Agree, 4 of 5" for screen readers) dressed as a
  segmented control, with the two ends and the chosen label spelled out.
- **Two modes.** *Order-linked* (`/feedback?order=KBB-…&t=<token>`): the token is the same
  HMAC as the order page's, so it needs no login; the dishes come from the order. *General*
  (footer, contact page, a QR on the bag): dishes are picked from the live menu. A reference with
  a bad token silently becomes general feedback — the page never confirms whether a reference
  exists. **General feedback is anonymous even if the visitor is logged in:** a person is tied to
  feedback *only* through an order link they chose to open (that is exactly what the privacy
  policy says). An earlier version attached the signed-in customer to footer feedback; testing
  caught it and it was removed. **One feedback per order** (unique index on `order_id`; a repeat gets "we already have
  it"). `?src=` is whitelisted (`email`, `dashboard`, `confirmation`, `footer`, `contact`,
  `packaging`, `direct`) — use `kebabish.nl/feedback?src=packaging` for a sticker/QR to count
  packaging responses separately.
- **The server action trusts nothing** (`feedback/actions.ts`): question ids and 1–5 values are
  checked against the real list, dishes against the real menu (or the order's own lines),
  comment trimmed to 1000, unknown keys dropped. Spam is handled by a honeypot, a per-instance
  throttle (`throttle.ts`, 6/hour, same blunt kind as the password-reset one) and the unique
  index — it is not a security boundary, and a submission only adds a row for staff to read.
- **Privacy:** two opt-in, unticked consents. *Contact me* — only then are a name and email kept
  on the row. *You may quote my comment (first name only)* — only offered once there is a
  comment; the admin shows an "OK to quote" badge (for the testimonials section, which is fed by
  `reviews-data.ts` by hand). The privacy policy (nl/en) lists feedback under data, purpose and
  retention, and its "last updated" date was bumped.
- **Unhappy customers are told to staff immediately.** `recommend <= 2` sends
  `sendLowFeedbackEmail` (same address as the new-order alert) with the order, dishes, comment and
  whether they may be contacted — a bad experience is cheap to fix only while it is fresh. The
  admin has a "Needs follow-up" filter (unhappy and not marked handled) and a banner.
- **Happy customers are asked for a public review.** After submit, `recommend >= 4` shows a
  "write a Google review" button **if** Settings → Feedback → *Google review link* is set (Google
  hosts only — `review-url.ts`; we have no Business Profile URL of our own to assume). Unset =
  not asked. An unhappy customer is never shown it.
- **Where customers are invited:** the **delivered email** (feedback is its main button, order
  page demoted to a link), the **customer dashboard** (a banner for the latest unrated delivered
  order from the last 14 days, plus per-order "Give feedback" / "Feedback sent"), the **order
  confirmation page** once the order is delivered and unrated, the **footer**, and the **contact
  page**. The page itself is `noindex` and not in the sitemap (it carries an order link in the URL).
- **Admin:** `/admin/feedback`, **owner/staff only** (`OwnerStaffOnly` layout + the action checks
  the role itself; managers and kitchen are turned away). Summary strip, per-question averages
  with a 1–5 distribution, dishes (mentions / favourite / taste), "how people found us", and a
  filterable responses list with "Mark handled". The admin is English-only and outside
  `[locale]`, so `labels.ts` reads the English messages server-side and hands the client
  component just the feedback slice (importing the whole file client-side would ship every page's
  copy). Statistics are pure functions in `stats.ts`.
- **Verified end to end (Oct 2026)** against real data: order-linked submit via the confirmation
  page and via the dashboard banner; duplicate blocked and the prompt disappears; bad token
  leaks nothing; honeypot silently drops; throttle trips after 6; consent respected (no
  name/email stored unless ticked); unhappy score emails staff; happy score shows the review
  button only when the link is set; admin stats, follow-up filter and Mark handled persist; manager,
  kitchen and logged-out sessions are turned away from `/admin/feedback`. The delivered email's
  feedback button was sent but its rendering in an inbox was not checked — look at the next real one.
- **Not built:** showing a response on the order's own admin page, and promoting a quote to the
  testimonials section automatically (reviews are added by hand in Website content → Reviews).

#### The feedback section above the footer (Oct 2026)

`src/components/feedback/FeedbackCta.tsx` is a charcoal card on a cream band, rendered **just
above the footer on every normal page**: home, `/menu`, every dish page, `/about`, `/contact`,
`/catering`, `/delivery-areas`, `/reviews`, `/privacy`, `/terms`. Deliberately **not** on
`/cart`, `/checkout`, the order confirmation (it has its own, order-linked prompt) or `/feedback`
itself. It is per-page rather than in `(site)/layout.tsx` because a layout can't know the path
without reading a header, and that would make every page dynamic — the menu and dish pages are
statically generated for SEO, which outranks saving ten one-line imports.

- **No `data-reveal` attributes anywhere in it.** Those are primed to `opacity: 0` under
  `html.js` in `globals.css` and are only unhidden by the `<Motion />` island, which `/menu`,
  `/contact` and the legal pages never mount — the whole section would have been invisible there.
- **The QR code is `hidden lg:block` plus `loading="lazy"`,** so a phone never downloads it: you
  can't scan your own screen. It is for someone reading on a laptop who would rather answer on
  their phone, and for pointing a camera at the screen. Two files, picked by locale, because a
  scan opens the URL cold and an English reader must not land on the Dutch form.
  `scripts/generate-feedback-qr.mjs` regenerates both (a one-off, like the favicon and OG-image
  scripts — it shells out to `npx -y qrcode`, so no QR encoder joins `package.json` for something
  the running site never does). The light modules are transparent so the cream tile shows
  through. **Verified by decoding the committed SVGs** (rasterised with sharp, read with jsQR):
  they resolve to `https://www.kebabish.nl/feedback?src=qr` and `.../en/feedback?src=qr`.
- **Two new `FEEDBACK_SOURCES`:** `site` (the button) and `qr` (the code), kept apart so it is
  visible whether anyone actually scans it before that code gets printed on anything. The
  contact page passes `source="contact"` to keep that existing signal; its old small feedback
  card was removed as a duplicate of the section now sitting below it.
- Copy lives in `messages/*.json` under `feedback.siteCta`. It promises nothing we don't do:
  "we read every response ourselves", "about two minutes", "anonymous unless you leave your
  name" (true — a name and email are only stored if the contact-me box is ticked). **There is
  no discount or reward offered**, because none is built.

### Editable website content (Oct 2026, migration `0019_site_content.sql`)

**The ask:** the owner changes what the website says and shows from the admin, without a developer.
Built as **Website content** in the sidebar → `/admin/content` (owner and staff; managers are
bounced — the layout is `OwnerStaffOnly` and every action calls `requireRole(OWNER_STAFF)`).
**Run migration 0019 before using it.** Until then the public site shows its built-in text, the
admin shows a "not set up yet" card, and one line is logged ("run migration 0019"). Nothing fails.

**The design in one sentence: an override layer.** Every public string already lived in
`messages/nl.json` / `en.json`, so an edit is a row that overrides *one dotted path* of that file,
merged over it in `src/i18n/request.ts` (`getMergedMessages`). **No component changed** —
`t("home.whyTitle")` is simply answered from the merged object. A field with no row is on its
default, so "Reset to default" = delete the row, and the shipped files stay the single source of
the original copy. If the database is down or a row is bad the site renders as it ships; **reading
must never fail a page** (`getContent()` swallows errors, logs at most once a minute, caches 15 s,
and a failure is cached 10 s so a dead database isn't hammered).

- **`src/lib/content/registry.ts` is the allow-list** — ~180 fields in 10 groups (homepage, about,
  delivery area, catering, contact, reviews page, menu page, header/footer/banners, coming-soon,
  SEO). The server refuses any key not in it and the loader ignores any stored key not in it, so the
  table can **never** override checkout, cart, the feedback form, error pages or **Privacy/Terms**
  (excluded deliberately: they name the legal entity and carry legal claims). To make a new string
  editable, add it to a group; nothing else is needed. Field kinds: `text`, `longtext`, `strings`
  (a list — the marquee), `faq` (Q/A pairs). `max` is per string.
- **The part that can take a page down is ICU.** Every `t("…")` string is parsed as ICU: one stray
  `{` or `<b>` typed into a heading throws while the page renders. So `model.ts` parses an edit with
  `intl-messageformat` first and allows only plain text plus the placeholders its default already
  has (`{radius}`/`{towns}` in the delivery SEO description, `{name}` on dish titles); it rejects
  `plural`/`select` and tags. Strings that *are* plural rules (`categoriesCount`, `resultCount`…)
  are simply **not in the registry**. `applyOverrides` re-checks each override at merge time and
  skips a bad one instead of throwing. Lists/FAQ are read with `t.raw`, so braces are harmless there.
- **Also rejected:** empty values (use Reset), over-length values, and the text "Marfah" (the
  public-site rule). A save is **all-or-nothing**: if any field is invalid, nothing is written and the
  messages are shown inline. Typing a field back to exactly its default is stored as a reset, not an
  override that happens to equal the default.
- **Both languages are edited side by side and are independent.** There is no machine translation:
  changing only Dutch leaves English on its own text. The editor shows the original under any edited
  field, "Edited" badges, last-changed-by, a per-field **History** (`site_content_history`, last 25;
  "Use this" only puts the old value in the box as an unsaved edit) and a sticky "N unsaved changes —
  Save & publish" bar. SEO fields get a length counter (title ≤ 60, description 110–160) and a Google
  preview. `beforeunload` warns about unsaved edits.
- **Storage:** `site_content (key, locale, value jsonb, updated_at, updated_by)` — only what the owner
  *changed* — and `site_content_history`. A table of its own, **not** the `store_document` JSON,
  because that document is read and written whole, so a content edit and a menu edit at the same
  moment would overwrite each other. `locale` is `nl`/`en` for text and `*` for language-independent
  values. Both tables are in `BACKUP_TABLES`.
- **Publishing:** every save calls `publish()` → `revalidatePath("/", "layout")`, `("/en", "layout")`,
  `/sitemap.xml` and the admin screens. In production a static page can be a little stale on a
  *different* server instance (≤ 15 s cache, then the layout's 60 s revalidate heals it), so the
  toasts say **"live within a minute"**, not "now". In dev it is instant.
- **Homepage sections** (`/admin/content/homepage`, `HOME_SECTIONS` in `model.ts`): show/hide and
  reorder (drag or arrows). `page.tsx` renders `getHomeLayout()`'s order. The **top banner is pinned**
  first and always on (the header floats transparent over it, so anywhere else it would be unreadable).
  Each section declares a `band` (dark / ember / pale / plain) and the editor **warns, never blocks**,
  when two same-colour bands touch or a dark one sits above the dark footer. Sections that render
  nothing yet (photo gallery with no photos, quotes with no reviews) are labelled "Nothing to show
  yet" and ignored by the warnings. `resolveLayout()` repairs anything stored (drops unknown ids,
  de-dupes, appends a section added to the site later, forces the banner first) — **to add a new
  homepage section, add it to `HOME_SECTIONS` and to the `sections` map in `(site)/page.tsx`**.
  Hiding the FAQ also removes its FAQPage JSON-LD (the schema is emitted by the component, so it can
  never describe content that isn't on the page).
- **Images & videos** (`/admin/content/media`, `MEDIA_SLOTS`): `heroWeb`, `heroMobile`, `story`,
  `aboutBanner` (follows `heroWeb` until it has its own) and `storyDetail` (a library photo). A slot
  with no row shows the file that ships in `public/`. **Video uploads are checked in the browser
  before anything is stored:** MP4/WebM ≤ 30 MB, **not HEVC/AV1** (read from the file's sample-entry
  tag — a phone-recorded HEVC clip plays on the owner's iPhone but shows only a still to most
  visitors, which is exactly what happened with the first mobile hero), the right *shape* for the slot
  (wide vs tall), ≤ 60 s. The clip's **first frame becomes its still** (canvas → `uploadPosterAction`
  → sharp → WebP in `media/posters/`), so the "poster = the clip's own first frame" rule holds for
  uploads. The clip goes straight to the `videos` bucket by signed URL (Vercel's body cap), and
  `saveMediaSlotAction` only accepts URLs from our own buckets. **Replacing or resetting deletes the old
  clip and poster** (best effort) — but `deletePosterByUrl` only ever deletes inside `posters/`, so a
  *library* image used by a slot is never removed. Media changes keep no history (the old file is gone).
  `lib/hero-video.ts`, `story-media.ts` and `hero-posters.ts` no longer exist; `Hero`, `HeroVideo`,
  `StoryFrame` (now async) and the About banner take their clips from `getSiteMedia()`.
  `<source type>` comes from the extension (`videoMimeType`), not a hard-coded mp4.
- **Reviews** (`/admin/content/reviews`, key `reviews.items`): name, 1–5 stars, text, source. Once a
  list is saved it *is* the list (so a review can be removed too); until then it is the (empty)
  `reviews-data.ts`. Everything that was keyed on `reviews.length` — the homepage quotes block, the
  Reviews page + its `noindex`, the footer link, the sitemap entry and the `aggregateRating`
  schema — now goes through `getReviews()`, so adding the first review switches all of it on.
- **Tested (Oct 2026):** `npx tsx scripts/check-content.mts` (960 checks, no database: every registry
  key exists in both message files with the right shape, every shipped default passes its own rules,
  hostile input — `{`, `<script>`, plural rules, empty, over-long, "Marfah", keys outside the registry
  — is rejected without throwing, `applyOverrides` ignores junk and never mutates the defaults, real
  `next-intl` formatting of the merged messages, layout resolution). **Run it after touching
  `messages/*.json`, `registry.ts` or `model.ts`.** In the browser (with an in-memory stand-in for the
  store): a Dutch edit shows on `/` and not `/en`; reset; history/"Use this"; marquee + FAQ edits
  (FAQ JSON-LD followed); layout hide/reorder reflected on the live page; reviews switching on the quotes
  block, page, footer link and rating schema; SEO counters/preview/placeholder check; a real HEVC clip
  refused, a tall clip refused in a wide slot, a valid clip uploaded to the real bucket and then reset
  (both objects gone from storage); library photo slot; a manager bounced from every screen.
  **The real Supabase SQL was then verified against the live database after migration 0019** (17
  checks: composite-key upsert, jsonb round-trips of unicode/braces/arrays/objects, reset = row
  deleted + a null history entry, newest-first history, `history:false`, pruning to 25, and the
  database's own `locale` check constraint rejecting a bad value), plus a full admin-UI edit → public
  page → reload → history → reset pass. All test rows were removed afterwards. (To run store code
  from a script: `NODE_OPTIONS=--conditions=react-server npx tsx --env-file=.env x.mts` — the
  `react-server` condition is what lets `server-only` load outside Next.)
- **Not built:** draft/preview-before-publish (publishing is instant, undo is History), translation
  help, editing Privacy/Terms, per-dish SEO overrides (the dish editor already owns those), and
  scheduling a change for later.

### Deleting data (Oct 2026)

The owner can delete everything from the panel. Menu items, categories, ingredients, allergens,
recipes, extras, promo codes, media, staff, reviews and website text (reset) always could be. What was
missing was **orders, customers and feedback responses**, which have no row-level "delete" until now.

**Orders** (`src/lib/admin/deletion.ts`, actions in `orders/delete-actions.ts`, UI in
`DeleteOrdersDialog` / `DeleteOrderControl` / `OrdersTable`): **owner only** (the page hides the
buttons from everyone else *and* every action calls `requireRole(["owner"])`; staff can still cancel
and refund, which leaves a record, but cannot erase one). Entry points: "Select unpaid" + "Delete
selected" in the Orders tables (all / new / completed), and a "Delete this order" card on an order's own
page. The dialog first asks the server for a **preview of what is actually in the selection**
(`previewOrderDeletion`) and states it:

- **Unpaid / abandoned / failed checkouts** are not sales: one click, no typing.
- **A sale** = paid, refunded afterwards, or carrying an invoice number. Dutch bookkeeping rules want
  invoices kept seven years and numbered without gaps, so any selection containing one requires typing
  **DELETE**. The server enforces this too (`deleteOrders(ids, confirmed)` refuses without it), not
  just the dialog.
- **Deleting does not refund.** An online (Mollie) payment that was never refunded is money the shop
  still holds; the preview shows the amount and says to refund first. **In-flight** orders (paid, not
  yet delivered/cancelled) are flagged — a customer may be waiting.
- Lines and refunds cascade (FKs); feedback just loses its `order_id`; a customer account is untouched.
  A delivery slot the order still held is released (not for cancelled orders or ones whose payment
  already failed/expired/cancelled — those released it then — and not for past dates).
- **Invoice numbering never goes backwards.** Deleting the newest invoices does **not** wind the counter
  back (an emailed PDF carrying that number may exist, and reusing it would put two different invoices
  in the world under one number); the toast says the sequence now has gaps. The one exception: when **no
  invoice for that year remains at all**, `invoice_counters` (and `credit_note_counters`) for that year
  are removed so numbering starts again at 000001 — exactly the "reset the invoice counter before launch"
  checklist step, now done by deleting the test orders.

**Customers** (`customers/actions.ts`, `DeleteCustomerDialog`): a *registered* account can be deleted
(sign-in, saved address, marketing consent). Their orders are **kept by default** — they are the shop's
records and each carries its own copy of the name/address — and simply unlink, then show under Customers
as a guest; a checkbox deletes them too. A *guest* has no account (they exist only as their orders,
grouped by email or phone), so deleting one means deleting those orders (`guestOrderIds` uses the same
grouping as the Customers list). Anything that deletes orders requires typing DELETE.

**Feedback** (`deleteFeedbackAction`, owner **or** staff like the rest of that screen): a two-step trash
button on each response; the summary figures recount.

**Tested against the live database (Oct 2026)** with throwaway `QADEL-` rows only (a script that was
deleted afterwards): 38 checks covering preview counts, unpaid delete without confirmation, paid refused
without it, FK cascades, invoice numbering restart / "gaps, no restart" / reset only once the last one is
gone, credit-note counters, input hardening (empty, non-uuid, >300, missing ids), guest grouping, account
delete keeping and unlinking orders, account+orders needing confirmation. Then through the real UI as
owner and as staff: staff see no delete control anywhere; "Select unpaid" picks only unpaid rows; the paid
order's dialog shows the invoice warning and stays disabled until DELETE is typed; order page, customer
page, guest row and feedback row all delete. All test rows were removed and the real order count and
invoice counter were checked unchanged. **One slip worth knowing about:** the refund test issued a real
credit-note number (`CN-2026-000002`) whose counter bump survived the deletion by design; it was set back
to 1 by hand because that number had never left the database.

### Promotion popup (Oct 2026)

A promo code can carry an **optional image** (`StoredPromoCode.imageId`, a media-library id, set in
*Marketing → Promo codes → Popup image*). While the code is valid, that image is shown as a popup to
visitors; **tapping the image adds the code to their basket and checkout applies it for them.** No
migration (it's a field in the store document). No image = no popup, so a code can stay private.

- **What decides whether a promo is advertised** (`src/lib/public-promos.ts`, `getPromoPopups()`, called
  from `(site)/layout.tsx`): it has an image that still exists, it is switched on, today is inside its
  start/end dates (Amsterdam day, same as checkout), and it isn't used up (`maxRedemptions`, counted like
  checkout does). Per-basket rules (minimum order, "only on kebabs", first-order-only) can't be known
  without a basket, so they are explained at checkout as before. Newest first. Never throws — a store
  hiccup means no popup, not a broken page. **An image makes the code public**: it is in the page data
  of every public page. The admin form says so; don't put an image on a code meant for one customer.
- **The code lives in the cart provider.** `CartProvider` now holds `promoCode` / `setPromoCode`
  (localStorage key `kebabish-promo-v1`, separate from the cart's own key so its saved format didn't
  change; `cleanPromoCode()` only lets `[A-Z0-9-]{3,30}` through). Promo codes used to exist *only* inside
  `CheckoutForm`'s component state, which is why "auto-add to cart" needed something persistent. Like all
  cart data it is untrusted: `checkPromoCodeAction` re-validates against the real basket on the server.
  `clear()` (run when an order is confirmed paid, `ClearCartOnPaid`) drops the code with the basket.
- **Checkout applies it itself**, once per code, through the same `checkPromoCodeAction` as typing it
  in (`CheckoutForm` effect; the state is set after the `await` — the lint rule forbids setState in an
  effect body). If it can't be used on this basket the normal message appears and the code stays in the
  box. Removing the code at checkout also forgets it, or it would come straight back. The cart page shows
  "Code X will be applied at checkout" with a remove button.
- **The popup** (`src/components/PromoPopup.tsx`, client-only, so no layout shift and nothing for a crawler):
  shown 1.8 s after load; **only once its image has loaded** (fetched invisibly first; a failed image means
  no popup — an empty frame is worse than none); not on `/cart`, `/checkout`, `/feedback`; closing or
  claiming it is remembered **per promotion for 3 days** (`kebabish-promo-popup-v1`), so a newer promotion
  can still appear but the same one doesn't nag; skipped if the visitor already holds that code; one popup
  per visit. Tapping the image saves the code and shows a confirmation ("Code X added") with a button to
  the menu (empty basket) or checkout. Modal: focus starts on the image and is trapped, Escape/backdrop/X
  close it, the page behind doesn't scroll (`body` overflow + `data-lenis-prevent`), `z-[80]` above the
  header (50) and cart drawer (60). `QUIET_DAYS`, `SHOW_AFTER_MS` and `QUIET_PATHS` are constants at the top.
- **Size:** the image is up to 26rem wide on phones and 45rem from `md` (capped at `100svh − 10rem` tall so the
  hint pill still fits); it was 26rem everywhere and read as tiny on a desktop.
- **The corner badge** (`src/components/PromoWidget.tsx`, mounted next to the popup in `(site)/layout.tsx`):
  a small charcoal pill above the WhatsApp button (it drops to the corner when WhatsApp is hidden because
  orders are paused) reading e.g. "50% korting / WELKOM50 · Nog 13d 6u". It is what stays on screen after the
  popup is closed, for the **same promotions** (`getPromoPopups()`, newest first, so an image is what makes a
  code public here too). Tapping it adds the code like tapping the popup image (it then reads "Code X added").
  The countdown runs to **the end of the code's last day in Amsterdam** (`endsAt`, `endOfAmsterdamDay()` in
  `public-promos.ts`, DST-safe — checked across both clock changes), shows days+hours, then hours+minutes, then
  minutes+seconds in the last hour, and the badge disappears itself at zero. A code with no end date shows the
  code and no countdown (nothing is invented). It renders only after mount (time depends on *now*, which the
  cached page can't know), can be hidden for the visit (`sessionStorage`), and stays off `/checkout` and
  `/feedback`. Wording: Website content → Header, footer & banners → *Promotion popup* (`promoWidget.*`).
- **A bug the test caught:** the delay timer and the "choose a promotion" step shared one effect, and
  choosing re-ran the effect, whose cleanup cancelled the timer — the popup never opened. They are now
  separate effects.
- **Deleting a library image** detaches it from any promo using it (the promo just stops having a popup),
  and the "used by" warning in Media lists such promos.
- Wording is editable in Website content → Header, footer & banners → *Promotion popup* (`promoPopup.*`).
- **Verified (Oct 2026)** with throwaway `QA*` promos in the real store (removed afterwards; the real
  `WELKOM10/20/50` untouched): the server hands the page only the valid imaged promos — a private code, a
  switched-off, an expired and a not-yet-started one are all excluded; popup appears after the delay with
  the image already loaded, focus on the image; tapping it saves the code and confirms; the cart page shows
  it; checkout auto-applied a 15% code (−€3.90 on €25.98) with no popup on that page; removing it sticks
  across reload; a saved code that has since expired shows "Deze code is verlopen." and applies nothing;
  a second visit shows the *other* promotion; Escape closes, unlocks scrolling and is remembered; at phone
  width the image fits with 16px margins and the close button stays on screen; the admin form saved an image
  on a code, and removing it drops the key and the popup.

### SEO audit and structured data (Oct 2026)

A full audit found real bugs, not polish. It was done by crawling the built site, and is now
guarded by **`node scripts/seo-validate.mjs`** (run it against a running
`npm run build && npm run start -- -p 3100`; it crawls every URL in the sitemap and checks the
points below mechanically — **re-run it after any change to a page, a schema or the sitemap**).

- **Open Graph was wrong on every inner page.** Next merges metadata one *top-level key* at a
  time: a page that sets any `openGraph` field replaces the layout's whole object, and a page
  that sets none inherits the layout's verbatim. So `/menu` and `/about` told Facebook, WhatsApp
  and LinkedIn that their title was "Kebabish Hoogkarspel" and their URL was the homepage — a
  link to the menu previewed as the homepage. (The same trap once made every canonical URL the
  homepage.) **Every page now builds its metadata with `pageMetadata({ locale, path, title,
  description, image?, noindex? })`** in `seo.ts`, which sets title, description, alternates,
  `openGraph` (incl. `og:url`, locale + alternate locale, image) and `twitter` together, so a
  page cannot forget one. The root layout's metadata is now only the fallback for the 404 and
  coming-soon pages.
- **`x-default` hreflang** was missing everywhere (and from the sitemap); it points at the
  Dutch URL.
- **Titles and descriptions are real copy, in `messages/*.json` under `seo.*`**, 110–160 chars
  with the local terms a search is matched on ("Pakistaans eten bezorgen Hoogkarspel"). They
  were 23–81 chars, several inherited from the layout, and the homepage title said "Kebabish"
  twice. The delivery-area description names the first three towns by distance
  (`Intl.ListFormat`, so "en"/"and" follows the language).
- **Dish pages:** title is `{name} — {category}` (category dropped on `/en` when it has no
  English name — an English title ending in a Dutch word reads as a mistake). The description
  is Danish's own text **only in the page's own language**: on `/en` a Dutch description is the
  fallback when no English one exists, so there it uses a generic English line instead
  (`PublicMenuItem.descriptionTranslated`). A short written description is topped up with the
  "delivered in Hoogkarspel" tail; the `Product` schema gets the full text, not the snippet.
- **`JsonLd` component:** every schema renders through it. Plain `JSON.stringify` inside a
  `<script>` breaks on a `</script>` in any string, and dish names/descriptions are typed by
  hand in /admin. It escapes `<` and U+2028/2029 (the separators are built with
  `new RegExp("\\u2028")`, not regex literals — a literal separator character in source is a
  syntax error).
- **Schemas, and what each is for:** `FoodEstablishment` (every page, via the layout: name,
  description, slogan, address, geo, hours, `areaServed` = the radius **plus each town by name**,
  KVK `identifier`, `vatID` once set in Settings, `potentialAction: OrderAction` with own-fleet
  delivery); `WebSite` and `FAQPage` (homepage); `Menu` + `CollectionPage` + `BreadcrumbList`
  (`/menu`); **`Product` + `Offer` on every dish page** (all photos, price, availability, and a
  `MerchantReturnPolicy` of "not permitted" — true per the Terms, no withdrawal right on fresh
  food); `AboutPage`; `ContactPage`; `Service` for delivery and catering, with the towns.
- **The business schema never names "Marfah Enterprise"** (the public-site rule); the validator
  fails if it does.
- **`hasDeliveryMethod` was removed** from the business block. It is not a property of a
  business (it belongs to `DeliveryEvent`/`ParcelDelivery`), so validators flagged it and Google
  ignored it. "Delivery only" is now expressed by the `OrderAction`'s `deliveryMethod` and by
  `Service`.
- **No dangling `@id` references.** Google reads each page's JSON-LD on its own, so `isPartOf`
  embeds a small `WebSite` node (`websiteNode()`) instead of a bare `{"@id"}` that only resolves
  on the homepage. The business node is on every page, so `{"@id": BUSINESS_ID}` is safe
  everywhere. The validator checks this.
- **Rules that keep schema honest:** a dish with no sellable price ships *without* `offers`
  (never a placeholder price); sold-out is `OutOfStock`; `aggregateRating`/`review` appear only
  once real reviews exist (Google ignores self-serving reviews on a LocalBusiness for rich
  results regardless; they are there for completeness). No `SearchAction` on `WebSite` because
  there is no search endpoint to point it at.
- **Sitemap:** lists every language version of each URL (`alternates.languages`, with
  `x-default`) and has **no `lastModified`**. It used to say `new Date()` — "every page changed
  just now", on every request — which Google learns to distrust and then ignores for the whole
  site. We have no real per-page date, so we report none.
- **robots.txt** also disallows `/kitchen`, `/forgot-password`, `/reset-password`.
- Smaller: the menu sidebar's "Categorie"/"Filters" labels were `<h2>`s sitting above the real
  content headings and are now `<p>`; extra dish-gallery photos get a real `alt`.

**Content, not code, limits English SEO:** the live categories and most dishes have no English
name or description filled in (`/admin` → category/dish → the English fields), so `/en` pages
fall back to Dutch text for those. Two pairs of dishes (`shami-kabab` / `shami-kebab-x-1`,
`chapli-kabab` / `chapli-kebab-x-4`) share an identical description — one dish with variants,
or distinct text, is better for search than two near-duplicate pages.

### Dish description, video and allergens on the public item page

`/menu/[slug]` used to show only a photo, name, price and the order panel.
It now also shows `StoredItem.description` (plain text, line breaks kept
via `whitespace-pre-line`), an optional video, and the dish's allergens.
Both new fields are edited in the dish editor — Description sits above
Gallery, Video below it.

**Allergens shown publicly are the union of two sources** —
`allergensFor()` in `public-menu.ts` merges the dish's manually flagged
`allergenIds` with everything its recipe's ingredients carry. Both,
because a manual flag covers a dish whose recipe doesn't exist yet and
the recipe covers an ingredient nobody remembered to flag; for allergen
information, under-reporting is the dangerous direction. Optional recipe
lines count too. The 14 statutory ones get translated names from the
`allergenNames` namespace; a custom allergen Danish adds himself has only
the label he typed, so the page falls back to that.

**Video uploads bypass the server entirely.** Images go through a server
action (`uploadMediaAction` → sharp), but a dish video can't: Vercel caps
a function's request body at ~4.5 MB. `createVideoUploadAction` only
*mints a signed upload URL*, and the browser PUTs the file straight to
Supabase Storage. It lives in its own public `videos` bucket (mp4/webm,
30 MB cap, enforced by the bucket as well as the action), kept separate
from `media` so that bucket stays images-only and 6 MB-capped. Since the
action hands out upload capability it checks the session itself rather
than relying on the page guard — server actions are callable directly.
Only URLs under our own bucket prefix are accepted when the dish saves
(`isOwnVideoUrl`), and replacing or deleting a dish removes the old
object (`deleteVideoByUrl`, best-effort — an orphaned file is never worth
failing a save over).

The item page renders the heading **once**, placed by grid rather than
duplicated per breakpoint. It used to be rendered twice (`lg:hidden` plus
`hidden lg:block`), which put two `<h1>`s in the DOM — bad on the page
type that matters most for SEO, and it would have become two `<h2>`s once
the allergens block landed.

### Extras (option groups)

Reusable groups of add-ons — sauces, drinks, toppings — managed at
`/admin/menu/extras` and attached to dishes by id, so repricing a sauce is
one edit rather than twenty. `minChoices`/`maxChoices` drive whether the
customer sees radios or capped checkboxes. **Seeded empty**: what the
extras are and what they cost is Danish's to fill in, not ours to invent.

The option rows submit as a single JSON field, not parallel
`optionLabel[]`/`optionPrice[]` inputs — see the opening-hours bug below
for why positional zipping of FormData arrays is a trap.

### The "Check if we deliver to you" box on /contact

`src/components/DeliveryCheck.tsx`: the card used to be a heading and a sentence telling people to "enter your
postcode" with **no input at all** (and the heading was invisible — the global `h2` colour is charcoal, on a
charcoal card; it now sets `text-cream-50`). It now reuses checkout's `PostcodeField` (PDOK suggestions, pick one)
and the same rule as `isDeliverableTown()`: delivery is decided by the **town** the postcode belongs to, matched
against `siteConfig.deliveryAreaTowns`, not by measuring km. Yes → "we deliver to {town}"; no → "{town} is outside
our delivery area" plus a pre-filled WhatsApp link. Typing over a picked postcode clears the answer (`onEdit`).
Wording is `contact.deliveryCheck*` in `messages/*.json`. Verified: 1616… → Hoogkarspel yes; 1012… → Amsterdam no.

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

**Checkout address entry is postcode-first, via PDOK — not Google
Places.** A Dutch postcode already pins down a single street, so
`PostcodeField.tsx` debounce-queries PDOK's Locatieserver (the Dutch
government's free, keyless, CORS-open address API, built on the official
BAG register — `api.pdok.nl/bzk/locatieserver/search/v3_1/{suggest,
lookup}`) as the customer types, and picking a suggestion fills the
(read-only) Street and Town fields below it. The customer only ever
types the postcode, house number, and an optional addition
("toevoeging", the Dutch standard — `Field` labelled accordingly).
`orders.address_street` is still one combined column, so the three are
joined client-side (`"{straat} {huisnummer} {toevoeging}"`) into a
single hidden `street` field on submit — no DB/schema change needed for
this. Town still goes through the same `isDeliverableTown()` check as
before (duplicated client-side, in `CheckoutForm.tsx`, for an inline
warning the moment an out-of-area postcode is picked, since it's no
longer a closed `<select>` that made an invalid town unselectable).

This replaced Google Places Autocomplete (`useAddressAutocomplete.ts`,
now deleted): it needed the Places API enabled on
`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`, which was never actually turned on
(`API_KEY_SERVICE_BLOCKED`), so it had silently never worked in
production. PDOK needs no key at all and is a better fit for NL
addresses specifically. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` is still used
elsewhere (`map-projection.ts`'s Static Maps image) — this only removed
its checkout dependency.

**Delivery time slots.** Every order — including "as soon as possible" —
picks a 45-minute delivery window at checkout, capped at 10 orders per
slot by default, so the kitchen never gets flooded all at once. Opening
hours are Thu-Sun 10:00-23:00 (set in `/admin/settings`, per Danish —
Mon-Wed are closed). Slots are never stored as rows; they're generated on
the fly from `settings.hours` by `generateDaySlots()`
(`src/lib/delivery-slots.ts`, a pure, isomorphic module — safe to import
from a Client Component, unlike the `-data.ts` file below). Only two
things need real rows, both in `0008_delivery_slots.sql`:

- `delivery_slot_config` — admin overrides (max capacity, on/off),
  **keyed by weekday + slot start time, not a specific date**: turning
  off "Thursday 18:00" turns it off for every future Thursday. Sparse on
  purpose — a slot nobody's touched just uses the defaults (10, enabled)
  baked into the Postgres function below, so changing opening hours never
  requires touching this table.
- `delivery_slot_bookings` — the live counter, keyed by the *specific*
  date + slot (every Thursday has its own count). This is a dedicated
  counter table with row-level locking, not a `count(orders)` query —
  counting rows can't stop a concurrent insert from slipping past the
  check (the classic phantom-read problem); a locked counter row can.

`reserve_delivery_slot()` (the Postgres function, called via `.rpc()`
from `src/lib/delivery-slots-data.ts`'s `reserveDeliverySlot()`) does the
whole check-then-increment atomically, so two customers racing for the
last spot in a slot can't both win. Called once, in `checkoutAction`,
right after re-validating the slot server-side (never trust the client:
the date/slot the form posted gets re-checked against real hours, the
real cutoff, and the real config from scratch, the same as every other
"never trust the client" check on this page). **A reserved slot has to be
released if the order doesn't happen** — `releaseDeliverySlot()` is
called from three places: `checkoutAction` itself (priceCart/minimum-
order/promo/Mollie failures, all *after* the reservation succeeds),
`cancelOrder()` (admin/rider declining or cancelling an order), and
`syncPaymentStatus()` (a payment that ends up failed/expired/cancelled).
Miss one of these and the slot's real capacity quietly shrinks forever as
abandoned checkouts pile up — this was worth getting right, since
capping the rush is the entire point of the feature.

**Each 45-minute slot is 30 minutes of live ordering + a 15-minute
prep/delivery buffer at its tail.** The 10:00-10:45 slot takes orders
until 10:30, 10:45-11:30 until 11:15, 11:30-12:15 until 12:00 — the slot
is still *running* during its buffer, it just won't accept anything new,
so the kitchen always has 15 clear minutes to cook and drive the last
order in it. `isPastCutoff()`, `BUFFER_MINUTES` and `LIVE_MINUTES`
(`delivery-slots.ts`) are the one place this lives; both the customer
picker and `checkoutAction`'s server-side re-check go through that one
function.

This was wrong in the first cut and Danish caught it: the cutoff was
applied 15 minutes *before* a slot's start (`start - 15`) rather than 30
minutes after it, which closed every slot before it ever opened — the
10:00 slot died at 09:45. If you touch this again, sanity-check it
against those three worked examples above, not just the constant.

Customers can schedule up to `BOOKING_WINDOW_DAYS`
(7) days ahead, including days the kitchen is currently closed — **checkout
is reachable at any time**, not gated on `getStoreStatus().isOpen` the way
it used to be, specifically so someone can open the site on a Monday
(closed) and book Thursday evening. Only the *chosen slot* has to be
real/open/available; "right now" isn't checked at all anymore.

The customer-facing picker (`DeliverySlotPicker.tsx`, polling
`/api/delivery-slots?date=…` every 20s) only ever shows two states —
Available / "Volgeboekt" (fully booked) — matching Danish's spec exactly;
it never shows the raw booked/max numbers. If the slot someone had
selected fills up before they submit, the poll notices, reassigns them to
the next available one, and shows an inline notice rather than letting
them submit into a full slot. The admin view
(`listSlotConfigForDate()`/`/admin/settings/delivery-slots`) is the
opposite: owner/staff only, and it's the one place the real "7/10" count
and the capacity/on-off controls live — editing a row there changes every
future occurrence of that weekday+time, not just the date being viewed,
which the page's copy says explicitly so it isn't a surprise.

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

**Orders table has a Payment column** (`PaymentStatusPill`, short wording: Paid / Pending / Failed /
Expired / Cancelled / Refunded; a paid order with some money handed back reads "Part refunded"). It is
sortable, has its own filter next to Status/Channel, and the CSV export gains "Payment status" and
"Refunded". "Pending" is `payment_status = 'open'` (checkout started or awaiting a manual payment-link
confirmation). The longer `PAYMENT_STATUS_LABELS` is the rider-facing wording and was left alone.

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

### Hardening and legal copy (spec review, Oct 2026)

Danish supplied a long implementation spec; it was audited against the code
and only part of it adopted (see the git log for what). Decisions that came
out of it and aren't obvious from the code:

- **Every mutating admin server action checks the role itself**
  (`requireRole()` in `src/lib/admin/guard.ts`). The layout guards only
  protect the *page*; a server action is a public POST endpoint. Menu
  actions other than dish actions are owner/staff; dish actions also admit
  managers. New admin actions must call `requireRole` first.
- **Price floor** — `MIN_DISH_PRICE` (€0.50, `money.ts`). A dish below it
  reads as "price on request" publicly, `priceCart` refuses it, and the
  admin form refuses to save it, so a €0.01 placeholder can never be bought.
  `priceCart` also rejects hidden dishes / hidden categories.
- **Checkout honours "Accepting orders"** server-side (`notAccepting`).
  Opening hours are deliberately *not* checked there — booking a later slot
  while closed is allowed.
- **Dashboard and reports count paid orders only** (`realOrders()` in
  `order-analytics.ts`); unpaid checkouts still show in the Orders list.
- **The confirmation page needs a token** (`order-token.ts`, an HMAC of the
  reference with `ADMIN_SESSION_SECRET`, carried as `&t=`), because the
  6-digit reference alone is guessable and the page shows name/address.
- **VAT rate and BTW-id are admin settings** (`/admin/settings` → Tax &
  invoices), not code. Prices already include VAT, so the receipt and the
  printed invoice *extract* it (`vatIncludedCents`). Nothing VAT-related is
  shown until they're filled in — we don't guess a rate. KVK is shown on the
  footer/contact/receipt/invoice; the BTW-id joins it once set. "Marfah
  Enterprise" still only appears on Privacy and Terms.
- Reviews link/sitemap entry only appear once there are reviews (added in Website content → Reviews).
- The slot rule stays 30 min live + 15 min buffer — the spec's "closes 15
  minutes before start" was deliberately *not* adopted.

**Priority 1 (payment lifecycle, invoice numbers, customer email):**

- **Abandoned checkouts release their slot** — `expireStaleOrders()` in
  `orders.ts`. There's no cron on this project, so it runs lazily (and at
  most once a minute per instance) from `/api/delivery-slots`,
  `checkoutAction`, `retryPaymentAction` and the admin order poll. It looks
  at orders still `open` more than `PAYMENT_HOLD_MINUTES` (15) after their
  last payment attempt (`updated_at`, not `created_at` — a retry restarts the
  clock) and asks Mollie what happened before acting. **iDEAL is not
  cancellable** (`isCancelable: false`); Mollie expires it itself 15 min
  after creation, so the hold ends when Mollie says so and the sweep notices.
  A cancellable open payment is cancelled first so it can't be paid after its
  seat is resold. Verified against the real Mollie test API.
- **"Pay again"** on the failed/expired page (`retryPaymentAction`) reuses the
  *same order* — same reference and lines — and only starts a new payment.
  It re-checks acceptingOrders and the slot (cutoff, capacity) and re-reserves
  it, because the first failure released it. `claimOrderForRetry` is the lock:
  only one request can restart an order, so a double click can't reserve two
  seats. Mollie returns an iDEAL *"failed"* to its own method picker rather
  than to us, so the retry button shows after cancel/expiry, not after that.
- **Invoice numbers** (`INV-2026-000001`, migration `0009_invoice_numbers.sql`)
  — a locked per-year counter, so there are no gaps. Assigned when an order
  is paid; the order reference (#KB-…) stays the customer-facing number.
  `getInvoiceNumber()` returns null if the migration hasn't been run, so
  nothing breaks before it is.
- **Customer confirmation email** (`email/order-confirmation.ts`), sent from
  the same first-paid transition as the kitchen alert, in the customer's
  language (carried through Mollie's payment metadata).
- Customer-facing and printed times are formatted in `Europe/Amsterdam` — a
  server in UTC (Vercel) otherwise prints them two hours off.

**Priority 2, batch 1 (kitchen, rider, order communication, refunds)** —
needs `0010_kitchen_and_order_lifecycle.sql` run *before* deploying (the order
queries read its columns):

- **Statuses:** `ready` ("Ready for delivery") sits between preparing and on
  the way and is *optional* — `ALLOWED_NEXT` lets preparing go straight to
  on_the_way, with a "Skip to…" button. Riders may only move an order into
  `on_the_way`/`delivered`. `accepted_at` is set when the kitchen accepts.
- **Kitchen popup** shows a live "Waiting m:ss" per order: amber at 3 min, red
  with an urgent banner at 5. At 5 min `escalateUnacceptedOrders()` emails the
  kitchen once (`escalated_at` is the once-only claim). It runs lazily from the
  admin poll **and** from `/api/cron/housekeeping`, which needs something to
  call it every minute (Vercel Cron on a plan that allows it, or a free pinger)
  with `Authorization: Bearer $CRON_SECRET` — without that, nobody-has-admin-
  open is not covered. Same endpoint also runs the stale-checkout sweep.
- **Kitchen ticket:** `/admin/orders/[id]/ticket` (a route handler, so it
  checks the role by hand) — slot, items, extras, customer note; no prices or
  address.
- **Customer emails** (`email/order-status.ts`): accepted, on the way,
  delivered, cancelled, refunded, in the language stored on the order
  (`orders.locale`). "Ready" sends none. The order page now shows a progress
  tracker and refreshes itself (`AutoRefresh`) — it used to *say* it refreshed
  without doing so.
- **Refunds:** `refundOrder()` — full refunds only, through Mollie; the
  conditional update to `refunded` is the lock against double refunds, and it
  reverts to `paid` if Mollie refuses. Declining a *paid* order refunds it
  automatically; the order page has a manual Refund button (owner/staff).
  `syncPaymentStatus` never flips `refunded` back to `paid`. Reports exclude
  refunded/cancelled orders from revenue but keep them in the counts.
  Partial refunds and credit notes are not built.
- **Rider screen** now shows the customer name, delivery slot, note, and
  Call / WhatsApp / Navigate buttons (`lib/phone.ts`). Still no order total —
  deliberate.

**Menu content (bilingual names, portion, featured, order)** — all optional
fields in the JSONB store document, so no migration:

- **Dutch is the default, English is an override.** `name`/`description`/
  category `label`/extras `label` are the default (Dutch) text; `nameEn`,
  `descriptionEn`, `labelEn` are used on `/en` *only when filled in*,
  otherwise the Dutch text shows — a missing translation never leaves a blank.
  `public-menu.ts` does this in one place (`pick()`), and the public
  functions take a `locale`. **Orders always snapshot the default (Dutch)
  name** — it's what the kitchen reads — and `localizeLineNames()` swaps in
  the English name only for the customer-facing receipt and confirmation email.
- **`portion`** is free text ("500 g", "4 stuks") shown beside the price.
- **Featured** (`featured`, at most `FEATURED_LIMIT` = 4, enforced in the
  create/update actions) replaces the old hard-coded slug list in
  `Popular.tsx`; with none flagged, the homepage falls back to the first
  orderable dishes.
- **Dish order** is the order of `store.items` within a category (that's what
  the public menu already used) — `moveItem()` swaps with the nearest dish of
  the same category, driven by the arrows in the admin items table ("Menu
  order" is its default sort and the only one the arrows work in).

**Password reset** (`/forgot-password` → emailed link → `/reset-password`) —
works for staff *and* customers, since they share `/login`; the email address
decides which table (admin_users first, like sign-in). No migration, no reset
table: the link carries `type.id.expiry.signature`, an HMAC with
`ADMIN_SESSION_SECRET` over those parts **plus a fingerprint of the account's
current password hash**. So it dies the moment the password changes (single-use)
and after 60 min, and can't be forged. The request form answers identically
whether or not the address has an account (no enumeration) and is throttled to
one email per address per minute *per server instance* (in memory — a blunt
instrument, Resend's limits are the backstop). The email is Dutch + English in
one message because these pages sit outside the locale routing and nothing
stores a language for an account. Both routes are in `proxy.ts`'s matcher
exclusions — add any new top-level auth page there too. Verified end to end,
including old password rejected, reused / tampered / wrong-account / expired /
garbage tokens rejected, and expiry against a freshly signed control token.

**Marketing consent and saved address** (migration
`0011_marketing_consent_and_saved_address.sql`, run *before* deploying):

- **Consent is opt-in only.** The checkbox is the only thing that can turn it
  on — signup form, checkout, or the account page — and none is pre-ticked. A
  logged-in customer's consent lives on `customers` (`marketing_opt_in`, when,
  and which of signup/checkout/dashboard it came from; withdrawing stamps
  `marketing_withdrawn_at`). A *guest's* tick at checkout is recorded on the
  order (`orders.marketing_opt_in`; the order's own time is the date). Ticking
  again later never overwrites the original consent date, and checkout never
  withdraws anyone. **Nothing sends marketing yet** — this only records it.
  Whoever builds campaigns must (a) send only to opted-in customers and
  opted-in guest orders not since withdrawn, and (b) put an unsubscribe link in
  every email; guests have no account page, so that link needs its own signed
  token (the password-reset token is the pattern to copy).
- **Saved address** only when "save this address" is ticked at checkout
  (signed-in customers only). Stored in the parts the form uses
  (`saved_street`, `_house_number`, `_addition`, `_postcode`, `_city`) so it
  can be put straight back; checkout then prefills it, plus name/email/phone.
  It is shown, and removable, on `/dashboard`. Saving the preference never
  fails a checkout — errors are logged and the order carries on.
- `PostcodeField` takes an `initial` address, and no longer reopens its
  suggestion list after a pick (the lookup is skipped for values we set).

**Promo codes — new options:** start date, total-use limit, first-order-only,
and "applies to" categories/dishes. `validatePromoCode` now takes the *priced
cart*, not a subtotal: a restricted code discounts only the qualifying lines
(and is "not applicable" when none are in the basket), and the checkout preview
prices the real cart server-side. The total-use limit counts paid orders plus
checkouts still awaiting payment (`promoRedemptionCounts`), so the last use
can't be handed to two people mid-payment — but it is a count-then-order
check, not atomic, so a simultaneous pair could oversell by one. Start/expiry
are compared on Amsterdam's calendar day, not UTC's. No migration.

**Manual (phone/WhatsApp) orders** (`/admin/orders/create`, migration
`0012_manual_orders.sql`, run *before* deploying):

- Priced through the same `priceCart` as a website order — the form says what
  was ordered, never what it costs; a hidden/sold-out/unpriced dish is refused.
  Staff can waive the delivery fee, skip the minimum, book a slot past the
  customer cutoff (capacity is still enforced), omit the email, and the town
  isn't checked against the delivery area.
- `orders.channel` is now website / whatsapp / phone / other (+ `channel_note`,
  50 chars, required for "other"); `orders.payment_method` is mollie / cash /
  bank_transfer / unpaid, and `created_by` records the staff member.
- **Only an online ("mollie") order can be abandoned**: the stale-checkout
  sweep filters on `payment_method = 'mollie'`. A cash/transfer/pay-later
  order has no provider to expire it; a person marks it paid
  (`markOrderPaid`, "Mark as paid" on the order page), which also emails the
  receipt if there's an address.
- Every manual order except the online-link one starts **accepted**
  (`preparing`) — staff took it, so the kitchen popup shouldn't ask again. The
  online-link one starts `new` and the popup fires when it's paid.
- Cancelling a paid cash/transfer order refunds nothing automatically (there's
  no Mollie payment) and says so; the rider sees "Collect cash" on an unpaid
  cash order. Guests with no email are grouped by phone number in Customers.
  Channel reporting now covers all four sources.

**Slot settings** (`/admin/settings` → "Delivery slots", plus per-day boxes in
the hours list; migration `0013_slot_default_capacity.sql`):

- **Slot length** (30–120 min, steps of 5; default 45), **orders per slot**
  (default 10) and **book ahead** (1–30 days; default 7) are settings, not
  constants. Each weekday can override length and capacity; blank = default.
  `effectiveHours(settings)` in `delivery-slots.ts` is the one place that
  resolves them, and everything that slices a day or checks capacity goes through
  it. Capacity precedence: a limit on one exact weekday+time
  (`delivery_slot_config`) > the day's override > the shop-wide default.
- **The 30+15 rule generalises, it doesn't change:** the buffer at the end of a
  slot stays 15 min (`BUFFER_MINUTES`), the live window is `slotMinutes − 15`,
  so a 45-min slot still closes at start+30 (checked: 45→10:30, 60→10:45,
  30→10:15). `isPastCutoff` takes the day's `slotMinutes`.
- Postgres can't read the JSON settings, so `reserveDeliverySlot` works the
  default capacity out and **passes it in** (`p_default_max`). 0013 adds that
  version of `reserve_delivery_slot`; the old 3-arg one is kept and the app falls
  back to it on `PGRST202`, so deploying before running 0013 keeps working at a
  limit of 10 (verified) — only the new capacity setting waits for the migration.
- **Changing slot length is disruptive and the form says so:** bookings are keyed
  by slot start time, so existing bookings keep their old times and the new
  slots start counting from zero, and per-slot limits on the Delivery slots page
  belong to a start time that may no longer exist. Do it on a quiet day.
- The checkout page passes `effectiveHours` + the window to `DeliverySlotPicker`;
  the booking window is enforced server-side in `checkoutAction` too.

Not done yet from the spec: `is_test` order flag.

### Order numbers (migration `0016_order_numbers.sql`)

Orders are numbered `KBB-2026-000123`: a per-year counter (`order_counters`), bumped
atomically by `next_order_reference()` — no `#`, so it is safe in URLs. Gaps are fine here
(an abandoned checkout used its number); the *invoice* number is the gap-free one. Orders
made before the migration keep their random `#KB-123456` reference — nothing is renamed and
nothing parses the format. Until 0016 is run, `newReference()` falls back to the old random
format (on `PGRST202`), so deploying first doesn't stop ordering.

### Interim payment mode: the shared Mollie Payment Link (migration `0017_payment_link_method.sql`)

While the full Mollie API integration can't go live, `Settings → Payments → Mollie payment
link` switches checkout to Danish's open-amount link (`payment-links.mollie.com/...`; only that
host is accepted, `src/lib/payment-link.ts`). Empty = the normal automatic checkout; the Mollie
code is untouched, so switching back is just clearing the field. We verified the link **cannot be
prefilled** (Mollie drops URL parameters) and gives the site **no webhook or return URL**, so:

- Checkout creates the order with `payment_method = 'payment_link'`, status `open`, and slot
  reserved — no Mollie call — and sends the customer to the confirmation page, which shows the
  exact amount and order number to type on the link plus a button. Staff get an "awaiting
  payment — do not cook" email (`sendPaymentPendingEmail`).
- **Staff confirm payments by hand:** find the payment in Mollie (amount + description = order
  number), then press *Mark as paid* on the order. Only then does the kitchen get its alert/board
  entry, the customer their receipt + invoice number (`markOrderPaid`). Nothing reaches the
  kitchen unpaid (the board and popup need `payment_status = paid`).
- Unpaid link orders lapse after `PAYMENT_LINK_HOLD_MINUTES` (90): slot released, shown as
  *expired*, never cancelled — and *Mark as paid* still works on an expired one (it re-takes the
  slot best-effort), so a late payer isn't lost.
- Refunds on these orders are "record only" (as for cash): refund in the Mollie dashboard, then
  record it here to get the credit note.
- Known weaknesses of this mode: amount/description are typed by the customer (staff must
  match them), no automatic confirmation, and a manual step per order. Remove it once the API
  checkout is live.

### Homepage sections, menu sidebar, dish gallery, cart (design pass, Oct 2026)

Danish asked for a round of visual work. What it changed, and the decisions inside it:

- **The hero no longer dims the video.** The full-bleed 65–95% charcoal wash is gone; only a
  top band (so the fixed header stays readable), a bottom band (scroll cue) and a soft bloom
  behind the copy remain. Legibility now comes from the type: `type-on-media` /
  `type-on-media-strong` in `globals.css` are two-layer text shadows that ride the letters, so
  bright frames get contrast exactly where it is needed and the footage stays untouched. The
  secondary CTA became a real glass panel (`bg-charcoal-950/40` + blur) because a 10% cream
  tint vanished over a bright frame. **The tagline is cream, not ember** — over flames and
  curry, ember-on-ember was unreadable; ember still carries the eyebrow, the primary button and
  every section accent. (Watch for this: `text-ember-300` does not exist — the scale starts at
  400 — and an undefined Tailwind token silently renders as inherited near-black.)
- **New sections**, in page order after Story: `Categories`, then (after Why) `Showcase`,
  `Testimonials`, and `Faq` before the final CTA. `Showcase` and `Testimonials` **render
  nothing** until there is real content behind them, the same rule as `aggregateRating`.
- **`Categories`** is built from `getPublicCategories()` (new, in `public-menu.ts`): visible
  categories with an item count, using the category's own photo, else a dish's from inside it.
  First tile spans two columns so the grid reads as composed at any number of categories.
- **`Showcase`** is the media library: *Settings → Homepage photos* (a `GalleryField`, same
  component the dish editor uses) writes `settings.galleryMediaIds`, an ordered list. Mosaic
  grid (every 6th tile 2×2) with a lightbox.
- **`Faq`** uses native `<details name="kebabish-faq">` — keyboard- and screen-reader-correct
  for free, works with JS off, exclusive-accordion where supported, and the answers are in the
  server HTML even while collapsed so they are indexable. It also emits **FAQPage JSON-LD**
  from the same strings. Content is in `messages/*.json` under `home.faq`; it states only
  facts already true (delivery-only, the radius, slots, allergens, no 14-day cooling-off) and
  deliberately avoids anything we would have to invent, prices and halal included.
- **Story shows a video** (`StoryVideo`): the vertical hero clip for now, mounted only when the
  section is near, never on save-data or 2g, and never under `prefers-reduced-motion`. The
  poster still is the server-rendered layer underneath, so it degrades to exactly what was
  there before.
- **Homepage "Populaire gerechten" is two dishes per row on mobile** (`Popular.tsx`, `grid-cols-2 gap-3`), like `/menu`;
  `FeaturedDishCard`'s container query supplies the compact layout.
- **`/menu` has a real sidebar on `lg`+** — search, categories as a list with *live counts*
  (a category nothing matches is greyed and unclickable), dietary checkboxes, clear-all —
  with dishes alone on the right. Below `lg` the compact search + filters-panel row is kept
  as it was. Dishes are **two per row on mobile**.
- **`FeaturedDishCard` sizes itself by container query, not viewport** (`@container` +
  `@min-[16rem]:`). The same card is ~160px wide two-per-row on a phone and full width on the
  homepage, and a media query cannot tell those apart. Narrow: tighter padding, smaller type,
  price stacked above a full-width button, leaf-only vegetarian badge.
- **The dish page shows every photo.** `PublicMenuItem.images` is new (all uploads in admin
  order, falling back to the one placeholder) — until now any photo after the first was
  uploaded and then never rendered anywhere. `ItemGallery` adds arrows, thumbnails, a counter
  and full-screen zoom **only when there are two or more**; one photo looks exactly as before.
  All of them are in the server HTML (inactive ones hidden, not absent) so they stay crawlable
  and switching cross-fades instead of flashing. The media column is **sticky** (`lg:sticky` +
  `lg:self-start` — a stretched grid item cannot stick), and a **related dishes** strip
  (`getRelatedItems()`: same category first, topped up from the rest, orderable dishes ranked
  first) closes the page.
- **The cart carries the dish photo.** `CartLine.image` is optional and never part of the
  line's identity; `inspectCart` now returns the current image and `CartProvider` backfills it,
  so baskets saved before this (and photos changed in /admin since) heal themselves without a
  reprice notice. Cart page and drawer both show it. The cart page is cards rather than a
  divided list, with a free-delivery progress bar (only when there is a fee to lose), the total
  on the checkout button, and three reassurance lines.

### Hero/story posters and the about-page banner

**The poster stills are frames of the clips.** `hero-poster.jpg` was a 1600x2133 portrait
photo of the *old* footage, shown full-bleed behind the current video — unrelated picture,
wrong shape. There are now two, cut straight out of the two clips with ffmpeg and pointed at
(these are the **shipped defaults**, named in `MEDIA_SLOTS` in `src/lib/content/model.ts`; the
owner can replace any clip from /admin/content/media — see "Editable website content"):

- `hero-poster.jpg` — 1920x1080, **frame 0** of `hero-web.mp4` (flames on black), upscaled with
  Lanczos + a light unsharp.
- `hero-poster-mobile.jpg` — 1080x1920, frame 0 of `hero-mobile.mp4`, which is pure black (the clip
  fades up) — correct, not a missing image.
- `about-poster.jpg` — 720x1280, frame 0 of `about-video.mp4`, for the story frame.

**A poster must be the clip's own first frame.** They used to be a detailed shot from the end of
each clip: from an 848x478 source stretched across a full-width hero it looked blocky and blurry,
and the video then started on something different, so the swap was jarring. No filter can make a
poster sharper than its footage, but frame 0 (soft flames on black) hides low resolution and is
seamless. The exact ffmpeg commands:

    web (16:9):    ffmpeg -ss 0 -i public/video/hero-web.mp4 -frames:v 1 -vf "scale=1920:1080:flags=lanczos,unsharp=5:5:0.5:5:5:0.0" out.png
    mobile (9:16): ffmpeg -ss 0 -i public/video/hero-mobile.mp4 -frames:v 1 out.png

then save as JPEG (quality ~90, 4:4:4 so dark gradients don't band). When the OWNER uploads a
clip the same rule is applied for him: the browser paints the clip's first frame to a canvas and
that is stored as the still (so "the poster is the clip's own first frame" holds for uploads too).

Re-run it whenever the *bundled* footage changes, since nothing regenerates these automatically. The hero's base layer is a `<picture>` with a `media`
source, not `next/image` — art direction needs two different files, and `hidden` on a second
`<Image>` would still download it. `HeroVideo` picks its own `poster` per variant.

**The story clip is `about-video.mp4`** (the `story` slot, poster `about-poster.jpg`) — its
own file, not a reuse of the hero's mobile clip, so the two change independently. The `/about`
banner still uses the widescreen hero clip (a portrait clip would not fit it).

**Both story sections share one component.** `src/components/shared/StoryFrame.tsx` is the
portrait video frame used by the homepage *and* `/about` — it was duplicated markup, which is
exactly how the about page kept showing a still after the homepage moved to video.

**`/about` opens with a video banner** (`shared/VideoBanner.tsx`, same lazy/save-data/
reduced-motion rules as `StoryVideo`). It carries the page's only `<h1>` — it replaced the
plain centred intro rather than being added above it, so there is still exactly one.

**Footage must be H.264, not HEVC.** The mobile clip was swapped for `hero-mobile-1.mp4`,
which arrived as HEVC Main 10 (10-bit) 1080x1920 at 8 Mbps — Chrome and Firefox often cannot
decode that, so phones would have shown only the poster. It was transcoded to H.264 8-bit
1080x1920 (`-crf 28 -movflags +faststart`, audio dropped, ~2.8 MB). It was 720x1280 at first, but
the source really is 1080x1920, so the native-resolution encode is visibly cleaner for ~0.4 MB more. Do the same for any future file:

    ffmpeg -i in.mp4 -an -vf "scale=1080:-2:flags=lanczos,format=yuv420p" -c:v libx264 -profile:v high       -crf 28 -preset slow -movflags +faststart -r 30 out.mp4

The widescreen clip (`hero-web.mp4`, 848x478) is still low-resolution and visibly soft on a
large display; a higher-resolution source is the only remedy for that one.

### The halal seal and the hero (Oct 2026)

- **The "100% halal" seal** (`public/halal.png`, Danish's own artwork) is fixed to the **bottom-left
  corner of every public page** by `src/components/HalalBadge.tsx`, mounted once in
  `[locale]/layout.tsx` — so it is also on the coming-soon page and the 404, and never in the
  admin/kitchen/rider apps (they sit outside `[locale]`). Bottom-right belongs to the WhatsApp button.
  It is `pointer-events-none` (on a phone that corner can hold a form field or button, and a decorative
  seal must never swallow a tap), `print:hidden` (no stamp on a receipt), 64px on phones / 96px from `sm`,
  and `loading="eager"` (it is on screen from the first paint, so lazy loading only makes it pop in late —
  and never fires at all in a hidden tab). The source PNG is 1254px/~800 KB; `next/image` serves a ~96px
  WebP instead. Its alt text is `common.halalBadge` in `messages/*.json`.
  **Whether the food is halal is a claim Danish makes, not one we inferred** — he supplied the image and
  asked for it to be shown on every page. Don't add halal wording anywhere else (FAQ, schema, copy)
  without him saying so; the FAQ deliberately avoids it (see the Faq note above).
- **The hero no longer carries the brand logo.** The logo mark above the "New in Hoogkarspel" badge was
  removed at Danish's request (the header already shows the logo). `data-hero-mark` and its line in the
  GSAP intro timeline (`Motion.tsx`) went with it; the eyebrow badge is now the first element and lost its
  top margin. The logo still appears in the header, footer, favicon and OG image.

### Error page and launch badge

`[locale]/error.tsx` says "Online bestellen is tijdelijk niet beschikbaar. Bestel gerust via
WhatsApp." and offers retry, a pre-filled WhatsApp link and the phone number — a broken page
must never be a dead end mid-order. The homepage's "Nieuw in Hoogkarspel" badge is the
`showLaunchBadge` setting (Settings → Taking orders; absent counts as on), so it can be switched
off when Kebabish is no longer new — no code change.

### Launch checklist (state as of the final readiness pass, 11 Oct 2026)

Code is launch-ready; what's left is data and accounts. Before turning the
gate off (`SITE_COMING_SOON=false` in Vercel, redeploy):

0. **Run `supabase/migrations/0019_site_content.sql`** (website content editing), then open
   `/admin/content` once to confirm it is no longer asking for it.
1. **Delete the test data** (now possible from the panel — Orders → "Select unpaid" / tick rows →
   "Delete selected"; paid ones ask for DELETE, and once no 2026 invoice remains numbering restarts at
   000001 by itself, so the manual counter reset is no longer needed): the old test orders (some paid, incl.
   a €0.01 one, which currently count as revenue), the `maha@marfahenterprise.com` customer if
   it's a test, and reset the invoice counter (`invoice_counters`) so the first
   real invoice is `INV-<year>-000001`. Check `WELKOM10`/`WELKOM20` are meant to
   be live.
2. **Mollie**: swap to the `live_` key, run one real payment end to end, and
   confirm in the live profile that the methods named in Terms and in the
   schema.org `paymentAccepted` (iDEAL, card, Apple Pay, Google Pay, Klarna)
   are really enabled — Apple Pay needs its domain verified in Mollie.
3. **Vercel env**: ADMIN_SESSION_SECRET, SUPABASE keys, MOLLIE_API_KEY,
   RESEND_API_KEY, ORDER_NOTIFICATION_EMAIL (optional), CRON_SECRET,
   NEXT_PUBLIC_SITE_URL, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, SITE_COMING_SOON. And
   something calling `/api/cron/housekeeping` every minute with
   `Authorization: Bearer $CRON_SECRET`.
4. **Real settings** in /admin: opening hours (Sunday was 00:00–23:00 while
   testing), delivery fee / free-delivery threshold, VAT rate and BTW-id (set),
   allergens on every dish (`shami-kabab` had none), 4 featured dishes.
5. After launch: submit `https://www.kebabish.nl/sitemap.xml` to Google Search
   Console; the canonical host is **www** (the apex 308-redirects to it).

Known and accepted: no login/checkout rate limiting, no error monitoring, no 2FA,
partial refunds/credit notes and marketing *sending* not built, login/signup pages
English-only. Root SPF lists only Hostinger; Resend authenticates by DKIM + its
own return-path subdomain, so mail from info@ works, but anything sent from
Google Workspace as info@ would fail SPF (DMARC is `p=none`).

### Refunds and credit notes (migration `0014_refunds_and_credit_notes.sql`)

Refunds are full **or partial** and each one is a row in `order_refunds` with its
own credit note number (`CN-2026-000001`, gap-free via `record_refund()`, which
inserts the row and takes the number in one transaction). `refundOrder()` lives
in `src/lib/refunds.ts`:

- **The guard is a compare-and-swap on `orders.refunded_cents`**, not a status
  flag — several refunds can follow each other, and two people clicking at once
  can't refund the same money twice (the second is told to reload). The order
  becomes `payment_status = 'refunded'` only when nothing is left.
- Mollie is called after the claim; if Mollie refuses, the total is wound back.
  If Mollie succeeds but recording fails (shouldn't), it does *not* wind back —
  it logs `REFUND MADE BUT NOT RECORDED` and tells the user, because unwinding
  would make the books lie the other way. It also probes the table first and
  refuses to touch Mollie at all if migration 0014 isn't there.
- A cash/transfer order has no Mollie payment: the same form then only
  *records* that a person handed money back, and still issues the credit note.
- **The customer may see a reason only if staff typed one** (`reason_customer`);
  `note_internal` is staff-only and never reaches a PDF, email or customer page.
- The **VAT inside each refund is frozen** at refund time (`vat_rate`,
  `vat_cents`), so a credit note doesn't change if the VAT setting does.
- **The original invoice is never changed** — it carries no refund line any more;
  corrections live on credit notes (`buildCreditNotePdf`, the same builder with the
  credit-note fields filled in, negative amounts, "relates to invoice INV-…").
  Credit notes are one correction line for the amount, not per-dish.
- Where they appear: admin Refunds panel on the order (history + PDFs + the form,
  owner/staff only to refund), `/admin/orders/[id]/credit-note?n=`, customer
  `/api/credit-note?ref=&t=&n=` (token-guarded like the invoice), the customer's
  order page and `/dashboard`, and attached to the refund email.
- Declining a paid order refunds what's left automatically (and the customer gets
  the credit note). Revenue in reports is `total − refunded`; per-dish/category
  sales stay at original amounts (a partial refund isn't tied to a line).

### Invoice PDF

`buildInvoicePdf()` (`src/lib/invoice/pdf.ts`) draws a one-or-more-page A4 PDF
with pdf-lib — pure JS, nothing read from disk at runtime (the logo is embedded
in `invoice/logo.ts`, regenerate with `scripts/generate-invoice-logo.mjs`; a
function on Vercel can't reliably read `/public`). `loadInvoiceData(reference)`
gathers the data and returns null for an order that was never paid, so there is
one source for all three places the PDF appears:

- **Customer download** — `/api/invoice?ref=&t=` (the same HMAC token as the order
  page; wrong/missing token and unknown reference are the same plain 404), linked
  from the order page and from each paid order on `/dashboard`.
- **Email attachment** on the confirmation email (best effort: if the PDF can't be
  made the email still goes out without it).
- **Admin copy** — `/admin/orders/[id]/invoice` (role-checked by hand, it's a
  route handler), so an order entered by phone with no email can still have its
  invoice sent over WhatsApp.

Contents: invoice number (INV-yyyy-nnnnnn) and order number kept separate,
invoice date = payment date, supply date = delivery date, seller KVK + BTW-id,
customer name/address, lines with extras and notes, subtotal/discount/delivery/
total, a VAT breakdown (base / rate / amount, from the VAT rate in Settings),
payment method and date, refund line if refunded, IBAN/BIC in the footer
(`siteConfig.bank`). It prints "Kebabish" only; the registered company name
(Marfah Enterprise) is added when **Settings → Tax & invoices → "Show the company
name on invoices"** is ticked (off by default; ask the accountant). Built-in
Helvetica covers Dutch/English; a character outside it is transliterated or shown
as "?" rather than crashing. **Refunds are on credit notes**, never on the invoice (see Refunds and credit notes).

### Cart stays honest against the live menu

A dish can sell out, be hidden, or have its extras changed after someone put it
in their basket. `CartProvider` therefore asks `/api/cart/check` (public,
read-only; `inspectCart()` in `orders.ts`) about every line — when the basket's
contents change, when the tab becomes visible, and every 60 s — and exposes
`issues` / `repriced` / `blocked`. A flagged line shows "Uitverkocht — Vandaag
uitverkocht", "Niet meer beschikbaar" or "Opties gewijzigd" (`CartLineNotice`),
the cart/checkout buttons are disabled with an explanation, and the rest of the
basket is left alone; the customer removes just the flagged lines. A *price*
change isn't blocking: the cart quietly catches up and says "Prijs bijgewerkt".
This is the friendly early warning only — `priceCart` still re-validates
everything when paying, and `checkoutAction` now says *why* it refused
(`itemUnavailable` / `optionsChanged` / `priceChanged`) instead of one generic
message.

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

### Kitchen role and the live orders board

A fifth role, `kitchen`, for the screen on the kitchen wall. It lands on
`/kitchen` (`homeForRole`), a top-level segment like `/rider` — own
`<html>/<body>`, excluded from the next-intl matcher in `src/proxy.ts`. It is
**optional**: owner/staff/manager can open `/kitchen` too, so a kitchen login
only exists to give the cooks *less* access, not because the board needs it.

Least privilege is enforced in three independent places, none of which trusts
the others:
- `kitchen/layout.tsx` allow-lists kitchen/owner/staff/manager; the admin
  layout already allow-lists owner/staff/manager, so a kitchen user who types
  `/admin` is bounced back to `/kitchen`.
- `GET /api/kitchen/orders` returns only what cooks need: order number, first
  name, slot, lines (qty + name), the customer note, payment state. **No phone,
  address, totals or email.** Its poll doubles as the heartbeat for
  `expireStaleOrders` / `escalateUnacceptedOrders`, like the admin popup.
- `updateOrderStatus` throws for a kitchen actor unless the target is
  `preparing` or `ready` — so the server action is safe even called directly.
  The kitchen cannot hand to a rider, deliver, decline or refund.

`listKitchenOrders()` = paid-and-unaccepted orders, plus anything accepted
(preparing/ready, paid or still-to-pay phone orders). Unpaid checkouts never
show. Board: waiting-to-accept first (longest wait on top; amber at 3 min, red
at 5), then preparing by earliest slot, then ready. A repeating two-tone beep
(synthesised, no audio file) sounds while anything is unaccepted; browsers
block audio until a tap, hence the "turn on sound" banner. The customer note
is shown in a box marked "check for allergies". Print link reuses the
existing `/admin/orders/[id]/ticket` route, which allows kitchen.

**Migration `0015_kitchen_role.sql` must be run before creating a kitchen user**
(it widens `admin_users_role_check`).

## What's already built (functionally working, committed to git)

- Bilingual routing/middleware, full site chrome (`Header`, `Footer`,
  `WhatsAppButton`)
- Homepage, `/menu` (all 6 categories, every dish from the finalized
  menu list), `/contact` (address, hours, socials, embedded map)
- SEO plumbing: `sitemap.ts`, `robots.ts`, per-page metadata, hreflang
  alternates, `FoodEstablishment` JSON-LD
- WhatsApp ordering: floating button site-wide, plus a pre-filled WhatsApp
  link on a dish that has no price yet (that one can't go in the cart).
  **"Order now" is not a WhatsApp link** — see below.
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
   `getSiteMedia()` (`src/lib/content/site.ts`) checks for each independently
   (the owner's upload, else the bundled file on disk), so either alone still
   works (used for both breakpoints) if the other is ever missing.
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
8. ~~Google Maps key~~ — **fixed.** `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` now
   starts `AIza` (a real key) and the Static Maps API works — the delivery
   map renders real tiles instead of falling back to its illustration.
   Google's Places API is still blocked for this key
   (`API_KEY_SERVICE_BLOCKED`/`REQUEST_DENIED`), but that no longer
   matters for checkout — see below, address entry doesn't use Google at
   all anymore.
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
