# EN | NL bilingual — implementation plan

**Status:** **all phases complete.** What remains is the launch checklist in §6 — a native
Dutch review of the flagged headlines, a legal read of the Dutch privacy policy, and the
production migration run.
**Owner:** — · **Created:** 2026-10-12 · **Updated:** 2026-10-12

Goal: the public website fully bilingual (English + Dutch) with per-locale URLs and SEO,
and the `/admin` panel bilingual by per-user preference. Production-ready, no stubs.

Tick the boxes as phases land. Keep the "Decisions" and "Traps" sections up to date — they
exist so nobody re-litigates a settled choice or re-discovers a landmine.

---

## 1. Decisions

| # | Decision | Rationale |
|---|---|---|
| D1 | **Symmetric `/en` + `/nl`.** `/` redirects by cookie → `Accept-Language` → default. | Both locales take identical code paths. Clean `x-default` on `/`. No "invisible default locale" to special-case forever. The redirect is an edge concern, not a render. |
| D2 | **No i18n library.** `next/root-params` + plain JSON dictionaries. | The pattern the installed `next@16.4.0` docs themselves recommend. Zero new dependencies (the tree is deliberately lean at 9). Avoids the `next-intl` × `cacheComponents` friction. EN and NL share one plural category, so ICU message format buys nothing. |
| D3 | **Admin is bilingual, by per-user preference** (`admin_users.locale`), not URL prefix. | Admin is behind auth and `noindex` — it has no SEO need for locale URLs. A preference that sticks is better UX for a Dutch dispatch team. Also sidesteps any `[locale]` vs `(admin)` route ambiguity. |
| D4 | **Localized URL slugs.** `/nl/rijd-met-ons`, `/en/drive-with-us`. | Only three public routes exist, so the slug map is ~60 lines and fully static. Cheap here specifically because the route count is tiny. |
| D5 | **Hash/anchor IDs stay English and stable** (`#services`, `#fleet`, `#enquire`). | Not indexed, and the language switcher must preserve the fragment across a locale change. |
| D6 | **Claude writes the Dutch; ~25 brand-critical headlines flagged for native review.** Formal **u** for clients, **je** for driver recruitment. | Standard Dutch register practice. The functional ~275 strings are safe as written; luxury brand headlines are exactly where translated-sounding Dutch cheapens the brand. |
| D7 | **Internal team email alerts stay English.** Customer-facing mail follows the stored `locale`. | `teamAlert()` in `lib/email.ts` is read by the operators, not customers. |

### Rejected alternatives

- **`next-intl`** — would be the default choice on a normal Next.js app. Rejected here because
  the project deliberately carries 9 dependencies, every translated string lives in a Server
  Component or a prop-fed Client Component, and the library's locale access has known friction
  with `cacheComponents` (see §2). Revisit only if ICU plural/select or runtime locale
  negotiation becomes a real requirement.
- **Cookie-only locale, no URL change** — not indexable. Google cannot see both languages.
  Disqualified for a site whose point is Dutch-market SEO.
- **`/` = Dutch, `/en` = English** (or the mirror) — viable, but asymmetric: one locale gets a
  different routing path from the other, forever.
- **Translating admin UI while leaving the audit log English** — the fake version of D3. See T1.

---

## 2. The finding that shapes the architecture

`next.config.ts` sets `cacheComponents: true`, and `"use cache"` is already in use in
`app/(site)/_components/sections/site-footer.tsx` (`CopyrightYear`) and
`app/(site)/drive-with-us/page.tsx` (`Criteria`).

Public web sources report `next/root-params` being unavailable inside `"use cache"`. **That is
stale.** The docs in the installed `next@16.4.0` document it working, with cache keys narrowed to
only the root params a cached function actually reads
(`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/next-root-params.md`,
§"Behavior with caching directives"):

```tsx
async function getNavigation() {
  'use cache'
  const language = await lang()   // supported, 16.3.0+
}
```

**Three hard restrictions drive the whole design.** `next/root-params` is **Server Components
only** — it throws in:

- Client Components (build error on import)
- **Server Actions** → see T2
- Route Handlers (planned, not shipped)
- `unstable_cache` (use `"use cache"` instead)

Also: with `cacheComponents`, every root param **must** have at least one `generateStaticParams`
value or the build fails.

---

## 3. Target structure

```
app/
  [locale]/
    layout.tsx            site root layout; <html lang>, generateStaticParams, notFound() on bad locale
    page.tsx
    not-found.tsx         localized 404 for in-site misses
    error.tsx
    site.css
    _components/
    drive-with-us/        physical folder; Dutch slug via the map in D4
    privacy/
  (admin)/admin/          unchanged paths, EN+NL by admin_users.locale
  global-not-found.tsx    truly unmatched roots only — cannot use root params
  robots.ts  sitemap.ts  icon.png  apple-icon.png  favicon.ico
lib/i18n/
  config.ts  get-dictionary.ts  interpolate.ts  pathnames.ts  types.ts
  dictionaries/en.json  dictionaries/nl.json
proxy.ts                  locale detect + redirect + NEXT_LOCALE cookie + existing admin pre-check
docs/i18n-en-nl-plan.md   this file
```

`/admin` resolves to `(admin)` rather than `[locale]` because Next.js matches static segments
before dynamic ones. Verified in Phase 0.

---

## 4. Phases

### Phase 0 — Spike (the gate)

Prove the foundation before touching ~50 files. Move **one** section (`Statement`, 3 strings)
under `app/[locale]/` and verify:

- [x] `await locale()` resolves inside a `"use cache"` function
- [x] `/admin` still routes to `(admin)` and is not swallowed by `[locale]`
- [x] `npm run build` passes with `generateStaticParams` returning both locales
- [~] `npm run typecheck` sees the generated root-param types — **deferred to Phase 2, cause known.** See T8.
- [x] An unknown first segment (`/foobar`) renders the 404, not a broken locale

**Verdict: gate passed.** D2 is sound — the no-library approach works on this exact stack.

Evidence (spike = `app/[locale]/` beside the untouched `app/(site)/`, one `Statement` section):

| Check | Result |
|---|---|
| Build output | `/en` and `/nl` both `○ (Static)`, `Revalidate 1d` — so the locale was read *inside* `"use cache"` and became part of the cache key, prerendering one static entry per locale |
| `.next/server/app/en.html` | `<html lang="en">` + English copy |
| `.next/server/app/nl.html` | `<html lang="nl">` + Dutch copy |
| `/foobar` | `404` — `notFound()` works in a root layout under `cacheComponents` |
| `/admin` | `307 → /admin/login?next=%2Fadmin` — proxy and admin routing untouched |
| `/`, `/privacy`, `/drive-with-us` | `200` — existing site unaffected |

Baseline `lint`/`typecheck`/`build` were captured clean *before* the spike, so nothing above is
inherited breakage.

### Phase 1 — i18n core

- [x] `lib/i18n/config.ts` — `LOCALES = ['en','nl'] as const`, `DEFAULT_LOCALE`, `isLocale()` guard
- [~] `lib/i18n/dictionaries/en.json` — created; holds only the spike's `statement` section so far (Phase 5 fills it)
- [~] `lib/i18n/dictionaries/nl.json` — same shape, same partial state
- [x] `lib/i18n/types.ts` — `type Dictionary = typeof import('./dictionaries/en.json')`
- [x] `lib/i18n/get-dictionary.ts` — `getDictionary(locale)` primitive **plus** a `getDict()` RSC
      helper wrapping `await locale()`. The explicit-argument form is mandatory: emails and
      Server Actions cannot use root params (T2).
- [x] `lib/i18n/interpolate.ts` — `{year}`/`{count}` substitution; warns in dev on a missing value
- [x] `lib/i18n/pathnames.ts` — slug map + `localizedPath` / `routeFromSlug` / `switchPath`, 17 cases verified

Parity is free: `nl.json` is loaded through a `Dictionary`-typed function, so a missing or
misnamed key fails `npm run typecheck`. No runtime lookups that silently return `undefined`.

### Phase 2 — Routing

- [x] Move `app/(site)/*` → `app/[locale]/*` (28 files, `git mv`, history preserved)
- [x] `generateStaticParams` + locale validation + `notFound()` in `app/[locale]/layout.tsx`
- [x] `<html lang>` from the root param
- [x] `generateMetadata` per locale (title, description, `og:locale`, `og:locale:alternate`).
      Deliberately **no** `alternates` on the layout: metadata is inherited, so a canonical there
      would wrongly apply to `/privacy` and `/drive-with-us`. Each page sets its own.
- [x] `proxy.ts`: cookie → `Accept-Language` (q-value parsing, no `negotiator`) → default;
      redirects unprefixed paths; `NEXT_LOCALE` cookie; admin pre-check preserved
- [x] Proxy skips `_next/`, `assets/` (matcher) and anything with a file extension (in code —
      easier to verify than a lookahead, and the matcher regex alone did **not** cover it)
- [x] Localized slug rewrites per D4, with a 308 from the folder spelling to the canonical slug
- [x] Language switcher replacing the hardcoded `EN | NL` span in `site-header.tsx`, and added to
      the `drive-with-us` header. Two `<Link>`s, `hreflang`, `aria-current`, works without JS.
- [x] Fragment preservation on switch (client component syncs `location.hash` after hydration,
      so there is no markup mismatch)
- [x] 404 strategy resolved — see T9. `global-not-found.tsx` is now bilingual; there is no
      `app/[locale]/not-found.tsx`, by necessity.
- [x] Stale `canonical`s on the two moved pages fixed (they still said `/privacy`,
      `/drive-with-us`, which the move had turned into redirects)

### Verified at runtime (production build, `next start`)

| Request | Result |
|---|---|
| `/` no header / `nl` / `en` / `de` | `307` → `/en` / `/nl` / `/en` / `/en` |
| `/` with `NEXT_LOCALE=nl` + `Accept-Language: en` | `307` → `/nl` (explicit choice wins) |
| `/en/privacy`, `/nl/privacybeleid`, `/nl/rijd-met-ons` | `200` |
| `/nl/privacy`, `/nl/drive-with-us` | `308` → canonical Dutch slug (one indexable URL) |
| `/en/privacybeleid`, `/en/rijd-met-ons` | `404` — a locale's slug does not leak into the other |
| `/privacy`, `/drive-with-us` | `307` → `/en/...` |
| `/foobar`, `/foo/bar`, `/nl/zomaar` | `404`, bilingual global 404 |
| `/robots.txt`, `/sitemap.xml`, `/icon.png`, `/apple-icon.png` | `200` (extension guard) |
| `/admin` → `/admin/login?next=%2Fadmin`, `/admin/login` `200` | unchanged |
| `<html lang>` + `<title>` | `en` / `nl` with the right language's title |
| `hreflang` on `/nl/privacybeleid` | `en`→`/en/privacy`, `nl`→`/nl/privacybeleid`, `x-default` |
| `Set-Cookie` | written only when the locale actually changes, so the statically prerendered pages stay cacheable |

All 6 locale pages prerender `○ (Static)`. Section copy still renders in English on `/nl` —
that is Phase 5, not a defect.

### Phase 3 — Data layer

Four migrations. Do these with the public site, not later — two of them are latent correctness
bugs, not cosmetics.

Done as **expand → backfill → contract** across two migrations, so a production deploy never has
code and schema disagreeing: `0004` is additive and harmless to the old code, `0005` only drops
what the new code no longer writes.

- [x] **`SERVICES` → stable keys**, now a `service_kind` pg enum (consistent with the existing
      `request_status` / `application_status` enums). `0004` maps the five English labels with a
      `CASE`, behind a `DO` block that **raises** on an unmapped value rather than coercing it.
      Labels live in `dictionaries.services.*`; `serviceLabel()` falls back to the raw key so an
      unrecognised value still renders.
- [x] **`locale` column** on `quote_requests` + `driver_applications` (`content_locale` enum,
      default `'en'`), carried from a hidden form field — a Server Action cannot read root params.
- [x] **`request_events.message` → `event` + `params`.** `event` is deliberately `text`, not an
      enum: a log's vocabulary grows, and recording a new kind of event should not need a schema
      migration. One row per save, with several `changes` in `params`, so row identity and the
      existing UI are preserved.
- [x] **`admin_users.locale`** column added. The UI control to set it belongs with the rest of the
      admin work in Phase 5.
- [x] Migrations applied and verified against the local database.

### The history backfill

The old prose was machine-generated by `updateRequest()`, so `0004` parses it into structured
changes rather than stranding it as opaque text — anything that does not parse is kept verbatim
under a `legacy` key and still renders. Amounts are stored unformatted (`"185.50"`), so they can
be rendered `€ 185,50` for a Dutch reader and `€185.50` for an English one.

Result on the local database: **21 `changes`, 12 `received`, 0 `legacy`** — the whole history
converted. The one row that initially fell back to `legacy` exposed a real gap in the parser
(`€2,150.00`, a thousands separator in hand-written demo data); the parser now tolerates
separators, and the backfill re-attempts `legacy` rows so an improved parser can heal them.

- [x] `lib/admin/events.ts` — types, `renderEvent()`, and an injected `formatAmount` so the module
      stays free of formatting concerns. Labels arrive as a parameter; Phase 5 swaps
      `EVENT_LABELS_EN` for the admin's dictionary and nothing else changes.
- [x] Customer-facing email now follows the stored locale (subject, greeting, body, field labels,
      service label) for both the quote confirmation and the applicant confirmation. Internal team
      alerts stay English per D7.
- [x] `scripts/seed-demo.mts` rewritten: service keys, structured history, and a locale per demo
      client (two Dutch) so the column is actually exercised.

### Phase 4 — Shared lib refactor

- [x] **`lib/partners/criteria.ts`** — now pure rules (numbers, model patterns, logic). Every
      string moved to `dictionaries.criteria` / `.documents` / `.declarations`, and the functions
      that produce text take a `CriteriaLabels`. `DOCUMENTS` and `DECLARATIONS` are plain key
      tuples rather than objects carrying labels. `COLOUR_EN`/`FUEL_EN` are gone — the RDW's own
      Dutch terms are the keys, so Dutch passes through and English is a lookup.
      `makeLabel()` is deliberately **not** localized: a make is a proper noun.
- [x] **Zod schemas are factories** — `quoteSchema(t)` / `applicationSchema(t)`. The old
      `text(label, max)` helper that built messages from sentence fragments is gone: it cannot
      survive translation (Dutch word order differs), so every field has its own explicit
      required / too-long message.
- [x] **Hidden locale field** in both forms; the actions resolve it through
      `dictionaryFromForm()`, which falls back to the default rather than failing a submission.
- [x] **All server-side validation and error messages localized** — both Zod schemas plus every
      `fail(...)` string in `lib/quotes/actions.ts` and `lib/partners/actions.ts`, and the
      client-side file checks in `application-form.tsx`. A Dutch visitor now gets Dutch errors.
- [x] **`lib/admin/format.ts`** — date functions take a `locale` that defaults to `"en"`, so
      existing call sites are untouched and Phase 5 only has to pass `admin_users.locale`.
      `pickupInstant()`'s `en-US` left alone and now carries a warning comment (T3).
      `formatEuro` deliberately stays `nl-NL` in both languages — a Dutch company quoting in
      euros should show the same amount either way.
- [x] **`lib/site-config.ts`** — `tagline` and `fleet.amenities` are now `Record<Locale, string>`
      (business copy the client edits, kept where the README says such things live), and
      `fleet.passengers` became `maxPassengers: 6`, rendered via `fleet.upToPassengers`.
- [x] Homepage JSON-LD is per-locale (`inLanguage`, localized `slogan` and `description`) and the
      homepage now emits its own `hreflang` set.

Dictionaries are at **151 keys**, parity enforced on every edit.

Verified at runtime: the criteria list, document labels, declarations, fleet lines and JSON-LD all
render per locale — and the criteria list does so from inside a `"use cache"` component, which is
independent confirmation that root params key the cache correctly (§2).

### Phase 5 — Copy extraction

- [x] All 15 section components, both forms, and the remaining client components
      (`concierge-input`, `back-to-top`, `brand-film`). Client Components receive a typed copy
      slice as a prop, so each bundle carries only the strings it uses.
- [x] `privacy/page.tsx` — the full policy, including the `{contact}` and Autoriteit
      Persoonsgegevens links, which are split around the inserted nodes rather than templated.
      `LAST_UPDATED` is now an ISO date formatted in the reader's language.
- [x] `drive-with-us/page.tsx` — written with **je/jij** per D6, unlike the client-facing pages.
- [x] `error.tsx` is bilingual for the same reason as `global-not-found.tsx` (T9): an error
      boundary is a Client Component and the error may have come from the layout that would have
      told us the locale.
- [x] Admin fully translated — nav, login, tables, stat cards, empty states, detail pages,
      forms, status labels, audit-log events, and the page `<title>`s.
- [x] `lib/email.ts` — done in Phase 3.
- [x] `admin_users.locale` control added to the admin sidebar (D3's remaining piece).

Dictionaries: **558 keys**, parity enforced.

### Verification built along the way

`scripts/check-translations.mts` (run it in CI next to lint/typecheck) checks what types cannot:
empty values, values identical across locales, and a stale allowlist. `ALLOW_IDENTICAL` records
the ~45 values that are *correctly* the same — brand and place names, model names, borrowed words
— so a genuinely untranslated string cannot hide among them.

A runtime leak check also ran against the rendered pages, comparing every English value against
the Dutch output (and the reverse): **0 leaks** across the three public pages and the three admin
pages. This is what caught the enquiry heading, which a hand-picked spot-check had missed — the
lesson being that a spot-check proves nothing here; only the exhaustive comparison does.

### Phase 6 — SEO

- [x] `generateMetadata` per locale for all three public routes
- [x] `alternates.languages` with `en`, `nl`, `x-default`
- [x] `openGraph.locale` + `alternateLocale`, localized OG image alt
- [x] JSON-LD `inLanguage`, localized `slogan` and `description`
- [x] `sitemap.ts` — 6 entries (3 routes × 2 locales), each listing both locales plus `x-default`
- [x] `robots.ts` — `Disallow: /admin` confirmed still matching

**`x-default` is the unprefixed path, not the homepage.** It was briefly `/` for every route,
which is wrong: `x-default` should point at the URL that negotiates a language, and the proxy
does that for `/privacy` and `/drive-with-us` too — not only `/`. `unprefixedPath()` in
`lib/i18n/pathnames.ts` is now the single source for it, used by both the page metadata and the
sitemap, so the two cannot drift. An e2e test asserts they agree.

### Phase 7 — Verification

- [x] `tests/e2e/site.spec.ts` rewritten: parameterized over both locales and driven by the
      dictionaries, so a copy change cannot silently pass a broken page. Adds locale redirect by
      `Accept-Language`, cookie precedence over the header, the switcher with **and without**
      JavaScript, canonical/`hreflang` per page, wrong-locale slugs 404ing, unprefixed redirects,
      and a bilingual 404.
- [x] `driver-application.spec.ts` is dictionary-driven too, and now **skips with a stated
      reason** when document storage is configured instead of failing — completing that flow would
      upload test files to the real Supabase bucket. CI runs without storage, so it runs there.
- [x] `npm run check:i18n` wired into `package.json` and `ci.yml` (after `typecheck`):
      - `scripts/check-translations.mts` — empty values, untranslated-identical values, stale
        allowlist entries
      - `scripts/check-literals.mts` — user-facing prose still hardcoded in a component
- [x] **Layout QA is automated, not a manual pass.** The 6 viewports now run in both languages
      (12 checks), asserting zero horizontal overflow and that the primary CTA stays visible.
      The longer Dutch strings — `Prijsopgave aanvragen` in the bordered CTA,
      `DE KUNST VAN EXECUTIVE GASTVRIJHEID` at 9px/`0.42em`, the section eyebrows — **pass at
      every breakpoint with no CSS changes needed.** The risk the plan anticipated did not
      materialise, which is worth recording rather than assuming.

### Migration rehearsal

The production path was rehearsed on a scratch database rather than reasoned about: a fresh DB
taken to the pre-i18n schema (0000–0003, recorded as applied), seeded with realistic rows
including a deliberately unmappable `'Executive roadshow'` and a
`Quote: — → €1,250.00` history line.

- The pre-flight **refused to run** and named the bad value and its row count — exit 1, nothing
  written. A safety check nobody has watched fire is not a safety check.
- After correcting that row: 2 migrations applied, `4 → 6` recorded, labels converted to keys,
  `locale` defaulted, `message` dropped, `event` NOT NULL.
- The `€1,250.00` thousands separator parsed to `"1250.00"` — the case that defeated the first
  version of the parser.
- The CI path (empty database, `DATABASE_URL` from the environment, no `.env.local`) applies all
  six from scratch and reports `0 → 6`.

### Final state

```
npm run lint        clean
npm run typecheck   clean
npm run check:i18n  570 keys in parity · no hardcoded strings in 52 components
npm run build       clean, 22 static pages
npm run test:e2e    31 passed, 3 skipped, 0 failed
```

`check-literals.mts` earned its place immediately: it found **16 strings I had missed** — the
`Driver name` label, both admin not-found pages, the two back-links, `Reset filters`, the RDW
open-recall warning, the approval note, and the error boundaries. A rendered-output leak check
could not have caught those, because they were never in a dictionary to compare against.

---

## 5. Traps

- **T1 — The audit log.** Translating admin UI while `request_events.message` holds English prose
  produces a bilingual interface wrapped around a permanently-English history. The structured
  `event` + `params` migration in Phase 3 is what makes D3 real.
- **T2 — Server Actions cannot read root params.** `await locale()` throws in a `"use server"`
  function. Both public forms must carry a hidden `locale` input, validated against `LOCALES`
  server-side. This is a correctness requirement: without it, a Dutch visitor gets English
  validation errors and an English confirmation email.
- **T3 — `pickupInstant()` is arithmetic, not display.** `lib/admin/format.ts` uses
  `toLocaleString("en-US")` inside `pickupInstant()` as a **timezone calculation**. Localizing it
  silently corrupts pickup-time math. Only `formatPickup`, `formatEuro` and `formatRelative`
  become locale-aware.
- **T4 — Production migrations.** ~~Uncomment the Supabase URLs in `.env.local`~~ — **don't.**
  That left you one forgotten re-comment away from migrating production from your laptop.
  `scripts/migrate.mts` picks its target from the `--env-file` you pass instead:

  | Command | Target |
  |---|---|
  | `npm run db:migrate:check` | local, **dry run** |
  | `npm run db:migrate` | local, applies |
  | `npm run db:migrate:prod` | production (`.env`), **dry run** |
  | `npm run db:migrate:prod -- --apply` | production, applies |

  It prints the host it is about to touch and marks anything non-local `*** NOT LOCAL ***`,
  refuses to write without `--apply`, runs the pre-flight below, and verifies afterwards. The four Phase 3 migrations need a deliberate production
  run — see the launch checklist.
- **T5 — `global-not-found.tsx`** sits outside `[locale]` and cannot use root params. The proxy
  keeps real site paths locale-prefixed, so in-site misses hit `app/[locale]/not-found.tsx`;
  the global file only catches unmatched roots.
- **T8 — root-param types are NOT generated, and cannot be without moving admin.** Two linked
  gotchas, plus a correction:
  1. `node_modules/next/root-params.d.ts` is a bare `declare module 'next/root-params'`, so the
     import typechecks as `any` **whether or not** generation succeeded. A green `typecheck` is
     *not* evidence the locale param is typed — check `.next/types/root-params.d.ts` directly.
  2. Generation found nothing because `collectRootParamsFromLayouts`
     (`node_modules/next/dist/server/lib/router-utils/route-types-utils.js`) treats a layout as a
     root layout only if no other layout is an ancestor:
     `!routes.some(other => other !== route && (other === '/' || route.startsWith(other + '/')))`.
     Route groups are stripped from paths, so `app/(site)/layout.tsx` registers as route `/`,
     which matches `other === '/'` and disqualifies `/[locale]`. Generated proof:
     `type LayoutRoutes = "/" | "/[locale]" | "/admin"`.

  **Correction (Phase 2):** removing `app/(site)/` did *not* fix it. `app/(admin)/layout.tsx` is
  also a bare route group, so it *also* registers as route `/`. Two culprits, same mechanism —
  `LayoutRoutes` is still `"/" | "/[locale]" | "/admin"`.

  **Resolution taken:** the `any` is pinned at one annotated boundary, `currentLocale()` in
  `lib/i18n/get-dictionary.ts`. Everything downstream is properly typed `Locale`. Runtime is
  unaffected and verified — both locales prerender correctly, because type generation and
  runtime resolution are independent.

  **Optional cleanup (not done):** flatten `app/(admin)/` → `app/admin/` so its layout registers
  as `/admin` rather than `/`. `LayoutRoutes` would become `"/[locale]" | "/admin"`, both would
  qualify, and `locale` would generate as `Promise<string | undefined>` — exactly what
  `isLocale()` takes. Deferred: it is ~15 more moved files for a typing gain only, and Phases 4–7
  are about to edit admin heavily. Worth doing *after* those, if at all.
- **T9 — a `[locale]` root layout cannot have a segment `not-found.tsx`.** Found by crash, not by
  reading. `[locale]` matches *any* first segment, so `/foobar` enters the tree with
  `locale="foobar"` and the layout calls `notFound()`. A not-found boundary renders *inside* its
  root layout — and that layout is the thing that threw, so Next.js returns its bare
  `<html id="__next_error__">` shell with no content. A `[locale]/[...rest]` catch-all made it
  worse, breaking every 404. The Next.js docs name this exact case as why `global-not-found`
  exists: *"Your root layout is defined using top-level dynamic segments … which makes composing
  a consistent 404 page harder."* So: **no `app/[locale]/not-found.tsx`**, and
  `global-not-found.tsx` is bilingual, since it bypasses rendering and can know no locale.
- **T11 — `drizzle-kit generate` needs a TTY, and `drizzle-kit migrate` targeted the wrong
  database.** Two problems, both hit in Phase 3:
  1. `npx drizzle-kit generate` aborts with *"Interactive prompts require a TTY"* when a change
     looks like it might be a column rename (here: `message` dropped while `event`/`params` were
     added). Splitting it into additive-then-destructive migrations removes the ambiguity and the
     prompt — which is the safer migration shape anyway.
  2. `npm run db:migrate` printed "migrations applied successfully" while the **local** database
     stayed empty. This was first recorded here as a silent no-op. **That was wrong**, and the
     truth was worse: it had applied the migration to **production**. See §5z.

  **Now handled in code.** `scripts/migrate.mts` replaces `drizzle-kit migrate`: it loads nothing
  implicitly, prints the host it is about to touch, refuses a non-local target when invoked with
  `--local`, and counts `drizzle.__drizzle_migrations` before and after — failing loudly if the
  number did not move by exactly the number of pending files. `drizzle-kit generate` is still what
  writes new migration files.

  `__drizzle_migrations.hash` is the plain sha256 of the `.sql` file, so editing an already-applied
  migration leaves the recorded hash stale — which is precisely what had to be reconciled in §5z.
- **T10 — the proxy must intercept invalid locales.** Because `[locale]` matches anything, an
  unknown first segment would still reach the layout and trigger T9. `proxy.ts` therefore rewrites
  unknown paths to `/_not-found` rather than passing them through. Without this, `/foobar` serves
  a blank error page — and a status-code-only check will not catch it, since it still returns 404.
- **T6 — CSP.** `next.config.ts` locks `connect-src` / `script-src` to this origin. The no-library
  approach needs no CSP change. Any future translation SaaS or font subset would.
- **T7 — Fonts.** `lib/fonts.ts` loads `subsets: ["latin"]`, which covers Dutch (ë, é, ij). No
  change needed — do not "fix" this.

---

## 5c. Notes from Phase 5

- **`"use cache"` + a cookie-read dictionary will break the build.** `adminDictionary()` reads the
  session cookie, so awaiting it in a layout or page *body* makes the static shell dynamic and
  `next build` fails with `blocking-prerender-dynamic`. The fix is to resolve it inside a
  `<Suspense>` boundary — an async child for the sidebar, and streamed `title`/`description` nodes
  for page headings (`PageHeader` already accepts `ReactNode`). Worth remembering for any further
  admin work.
- **Status and event labels moved out of `lib/admin/format.ts`.** `STATUS_LABEL` and
  `APPLICATION_LABEL` are gone; only the styling maps remain. `StatusBadge`/`ApplicationBadge`
  resolve their own labels, which is cheap because `getAdmin()` is request-deduplicated.
- **The login screen uses `DEFAULT_LOCALE`**, since nobody is signed in yet and there is no
  preference to read.

## 4a. Note for Phase 5

Admin currently calls `getDictionary("en")` in five places, each marked with a comment. Phase 5's
admin work is mostly mechanical: swap those for the signed-in admin's `admin_users.locale`, pass
that same locale into the `lib/admin/format.ts` date helpers, and replace `EVENT_LABELS_EN` in
`lib/admin/events.ts` with the dictionary. The storage format and all call signatures are already
final, so nothing else has to move.

## 5z. Incident — 2026-10-12: a local migration hit production

**What happened.** `npm run db:migrate`, intended for the local Docker database, applied migration
0004 to **production** Supabase at 09:58. It was recorded here as a silent no-op (T11), and the
plan stated production had never been touched. Both were wrong.

**Cause.** `drizzle-kit` bundles `tsx`/`esbuild-kit`, which loads `.env` by itself. The npm script
passed `--env-file-if-exists=.env.local`, setting `DATABASE_URL` to local Docker — but `.env` also
set `DATABASE_URL_DIRECT` to Supabase, and `drizzle.config.ts` resolves
`DATABASE_URL_DIRECT ?? DATABASE_URL`. Production won. The check that "proved" the target was local
used plain `node`, which does **not** auto-load `.env` — so it reported local, and was believed.

**Impact.** Production's schema ran ahead of its deployed code for ~8 hours. `service` became an
enum while the live code still wrote English labels, so **every quote-form submission failed** with
`invalid input value for enum service_kind`. The last genuine enquiry predated the incident, so no
enquiry is known to have been lost — but that cannot be proven.

**Fix.** `scripts/remediate-0004.mts` reconciled the migration record (production held the original
0004's hash; the repo's had since been hardened), re-ran the improved backfill to heal the one
`legacy` event the original parser could not read, and applied 0005. Verified afterwards: `message`
dropped, `event NOT NULL`, zero legacy rows, six migrations recorded, 13 rows intact. Deploying the
committed code closed the outage. That script describes one specific broken state — delete it once
this is comfortably behind you.

**Prevention.** `scripts/migrate.mts` loads nothing implicitly; the local npm scripts pass `--local`
and it hard-refuses any non-local host under that flag (verified by pointing it at a remote host and
watching it exit 1); `db:migrate:prod` prints the host, marks it `*** NOT LOCAL ***`, and will not
write without `--apply`.

**The lesson worth keeping:** a tool that reads configuration you did not hand it can target
something you did not choose, and verifying the target with a *different* loader than the tool uses
proves nothing. Make the tool state what it is about to touch, and make the dangerous target
impossible to reach by accident rather than merely unlikely.

## 5a. Blockers

- ~~**B1 — Phase 2's move needs permission.**~~ **Resolved** — run by hand, 28 files via `git mv`
  with history preserved. (It did not unblock T8; see the correction there.)

## 5b. Pre-existing on `main` (found during Phase 0)

`npm run lint` already fails on `main`, before any i18n work — 3 × `@next/next/no-html-link-for-pages`:

| File | Line | Link |
|---|---|---|
| `app/(site)/_components/quote-form.tsx` | 138 | `<a href="/privacy">` |
| `app/(site)/_components/application-form.tsx` | 227 | `<a href="/privacy">` |
| `app/(admin)/admin/error.tsx` | 27 | `<a href="/admin/">` |

Convenient overlap: the two form links must become `localizedPath("/privacy", locale)` for D4
regardless, so switching them to `<Link>` is the same edit. Fold into Phase 5 rather than
fixing separately. The admin one is independent — fix it whenever.

`typecheck` and `build` were both clean on `main`.

⚠️ **CI is therefore already red on `main`**: `.github/workflows/ci.yml:36` runs `npm run lint`,
which exits non-zero on the above. Worth fixing before judging any i18n branch's CI result.

**Also pre-existing: 3 e2e failures, environment-coupled.** `tests/e2e/driver-application.spec.ts`
contains no `setInputFiles` call, so it never uploads the four required documents. It passes only
when `storageConfigured()` is false — which is the case in CI (`ci.yml` sets `DATABASE_URL` only),
but *not* locally, where `.env.local` has `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` set. With
storage configured the form correctly rejects the submission and the 3 tests fail. Unrelated to
i18n; fold a document-upload path into the spec during Phase 7.

Local run after the move: **15 passed, 3 failed** (exactly those). Still 15/3 after Phase 3.

**Fixed along the way** (all three lint errors, so `lint` is now clean and CI's blocker is gone).
Two of them were a live bug rather than a style nit: the `<a href="/privacy">` in both forms sent
a Dutch visitor to the English page once localized slugs existed. They now use
`localizedPath("/privacy", locale)`.

**One e2e assertion updated, not worked around.** `quote-flow.spec.ts` asserted `€ 185,50` as a
bare `getByText`. History amounts are now rendered with `formatEuro`, so the string appears in
both the activity log and the summary and Playwright's strict mode rejected the ambiguity. The
old history hardcoded `€185.50`, which was wrong for a Dutch admin. The assertion now checks the
whole log line, which is stronger than before.

## 6. Launch checklist additions

Fold into the existing checklist in `README.md`:

- [ ] Migrations run against the **production** Supabase database (T4):
      `npm run db:migrate:prod` to preview, then `npm run db:migrate:prod -- --apply`.
      The pre-flight refuses to start if `quote_requests.service` holds a label it cannot map —
      it names the values and their row counts so they can be added to `LEGACY_SERVICE_LABELS`.
- [ ] ~25 flagged brand headlines reviewed by a native Dutch copywriter (D6)
- [ ] Dutch privacy policy reviewed as a legal text
- [ ] `hreflang` tags verified **on the deployed site** (asserted locally by an e2e test, but
      worth confirming against the real domain once `SITE_URL` is final)
- [ ] Both locales submitted in Search Console; `sitemap.xml` lists both
- [x] `/` redirect for a Dutch browser, an English browser and a returning visitor with a
      `NEXT_LOCALE` cookie — covered by e2e tests, including that the cookie beats the header
- [ ] Each admin's `locale` preference set
- [ ] Test quote submitted in **both** languages — confirm the confirmation email language
      matches the form language

---

## 7. Scope

~50 files touched · 4 migrations · ~550 strings (~300 public, ~250 admin).

The three items most likely to exceed their estimate: the audit-log refactor (T1), the `SERVICES`
key migration (a latent correctness bug, not cosmetic), and the Dutch-length layout fixes (Phase 7).

**Possible split:** Phases 1–3 are shared. If the public site should ship first, Phases 4–7 can be
cut to public-only and admin follows as a second pass — but the audit-log migration should still
land with the public site to avoid a second migration against production data.

---

## 8. Open

- [x] **Brand film needs no Dutch cut.** `build-brand-film.mts`'s filter chain is only
      `setpts`/`fps`/`format` — no `drawtext`, so nothing is overlaid. Frames sampled from the
      start, middle and the final 14 seconds of `public/assets/brand-film.mp4` show vehicle
      footage with no burnt-in copy and no end-card: the script's 1:17–5:05 trim cuts off
      whatever the original Mercedes press film ended with. The only text on screen is a German
      licence plate and the car's own dashboard UI.
      Update 15 Oct 2026: the film is now the client's own cut, `brand-film-v2.mp4` (same footage,
      "ECRAM EXECS" on the plates). Sampled frames across its 114 s show no other burnt-in copy,
      so a Dutch cut is still not needed; re-check if the client sends a longer edit with titles.
      Update 22 Oct 2026: replaced by the client's 51 s showreel, `brand-film-v3.mp4` (airport to hotel
      in Amsterdam). Sampled across its length there is no burnt-in copy except the closing end card:
      the logo and the English tagline "THE ART OF EXECUTIVE HOSPITALITY". The site translates that
      tagline in the emails (`email.tagline`), so a Dutch end card would need a Dutch cut from the client.
- [ ] Dutch register on `drive-with-us` — plan assumes **je**. Confirm with the client; a premium
      brand may prefer **u** even for driver recruitment.
