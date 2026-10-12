# EN | NL bilingual — implementation plan

**Status:** approved, not started · **Owner:** —  · **Created:** 2026-10-12

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

- [ ] `await locale()` resolves inside a `"use cache"` function
- [ ] `/admin` still routes to `(admin)` and is not swallowed by `[locale]`
- [ ] `npm run build` passes with `generateStaticParams` returning both locales
- [ ] `npm run typecheck` sees the generated root-param types (`next typegen` runs first)
- [ ] An unknown first segment (`/foobar`) renders the 404, not a broken locale

**If any of these fail, stop and revise the architecture rather than working around it.**

### Phase 1 — i18n core

- [ ] `lib/i18n/config.ts` — `LOCALES = ['en','nl'] as const`, `DEFAULT_LOCALE`, `isLocale()` guard
- [ ] `lib/i18n/dictionaries/en.json` — source of truth, nested by section
- [ ] `lib/i18n/dictionaries/nl.json` — same shape
- [ ] `lib/i18n/types.ts` — `type Dictionary = typeof import('./dictionaries/en.json')`
- [ ] `lib/i18n/get-dictionary.ts` — `getDictionary(locale)` primitive **plus** a `getDict()` RSC
      helper wrapping `await locale()`. The explicit-argument form is mandatory: emails and
      Server Actions cannot use root params (T2).
- [ ] `lib/i18n/interpolate.ts` — `{year}`, `{count}` substitution (~15 lines)
- [ ] `lib/i18n/pathnames.ts` — declarative slug map + `localizedPath(route, locale)`

Parity is free: `nl.json` is loaded through a `Dictionary`-typed function, so a missing or
misnamed key fails `npm run typecheck`. No runtime lookups that silently return `undefined`.

### Phase 2 — Routing

- [ ] Move `app/(site)/*` → `app/[locale]/*`
- [ ] `generateStaticParams` + locale validation + `notFound()` in `app/[locale]/layout.tsx`
- [ ] `<html lang={await locale()}>`
- [ ] `proxy.ts`: locale detection (cookie → `Accept-Language` with q-value parsing, ~20 lines,
      no `negotiator` dependency) → redirect unprefixed paths → set `NEXT_LOCALE` cookie →
      **keep the existing admin session pre-check**
- [ ] Proxy matcher excludes `/_next`, `/assets`, `/admin`, `robots.txt`, `sitemap.xml`, icon files
- [ ] Localized slug rewrites per D4
- [ ] Language switcher replaces the hardcoded `EN | NL` span at
      `app/[locale]/_components/sections/site-header.tsx` (currently line 40) — two `<Link>`s
      with `hreflang` + `aria-current`, working without JS
- [ ] Fragment preservation on switch (~10 lines of progressive enhancement; the server cannot
      see `#fleet`)
- [ ] `app/[locale]/not-found.tsx`; decide `global-not-found.tsx` presentation (bilingual or
      default EN — it sits outside `[locale]` and cannot read root params)

### Phase 3 — Data layer

Four migrations. Do these with the public site, not later — two of them are latent correctness
bugs, not cosmetics.

- [ ] **`SERVICES` → stable keys.** `quote_requests.service` currently stores the English label
      `"Airport transfer"`. A Dutch visitor selecting "Luchthaventransfer" cannot write that
      value. Change `lib/quotes/constants.ts` to
      `['airport_transfer','business_travel','hourly','private_occasion','bespoke']`, move labels
      to the dictionaries, and migrate existing rows with a `CASE` mapping.
- [ ] **`locale` column** on `quote_requests` + `driver_applications` — so the confirmation email
      goes out in the language the customer used, and the team knows which language to reply in.
      Backfill existing rows to `'en'` (they came from an English-only site).
- [ ] **`request_events.message` → `event` key + `params` jsonb.** Required by D3: the log
      currently stores English prose (`"Request received via website"`, `"Status: new → quoted"`)
      written by the server actions. Migrate existing rows to a `legacy` passthrough key that
      renders verbatim, so no history is lost or mistranslated.
- [ ] **`admin_users.locale`** — the admin language preference, with a UI control to set it.
- [ ] `npm run db:generate` → review SQL → `npm run db:migrate`

### Phase 4 — Shared lib refactor

- [ ] **`lib/partners/criteria.ts`** — the largest lib change. `criteriaText()`, `vehicleChecks()`
      labels and issues, `COLOUR_EN`, `FUEL_EN`, `DOCUMENTS` labels/hints, `DECLARATIONS` labels
      and `makeLabel()` are English prose consumed by the public page, the admin review screen
      **and** email. Split it: pure data (keys, numbers, regexes) stays; all strings move to the
      dictionaries; functions take a dictionary parameter. Rename the `*_EN` maps — for the NL
      locale the RDW's own Dutch terms pass through unchanged.
- [ ] **Zod schemas become factories** — `quoteSchema(dict)` / `applicationSchema(dict)` instead
      of module constants, since every `.min(1, "Please enter …")` message is user-facing.
      Files: `lib/quotes/validation.ts`, `lib/partners/validation.ts`.
- [ ] **Hidden locale field** in both forms, validated against `LOCALES` server-side (T2).
      Files: `lib/quotes/actions.ts`, `lib/partners/actions.ts`.
- [ ] **`lib/admin/format.ts`** — `formatPickup`, `formatEuro`, `formatRelative` become
      locale-aware (`en-GB` → the admin's preference). **Do not touch `pickupInstant()`** (T3).
- [ ] **`lib/site-config.ts`** — `tagline`, `fleet.passengers`, `fleet.amenities` are prose in a
      config file. Restructure: `passengers: 6` as data, formatted per locale; tagline to the
      dictionaries.

### Phase 5 — Copy extraction

- [ ] 15 section components under `app/[locale]/_components/sections/`
- [ ] `quote-form.tsx` (~40 strings) and `application-form.tsx` (~45) — Client Components, so
      they receive a typed dictionary slice as a prop from their Server Component parent. This
      also keeps each client bundle to only the strings it uses.
- [ ] Remaining client components: `concierge-input.tsx`, `back-to-top.tsx`, `nav-auto-close.tsx`,
      `brand-film.tsx`
- [ ] `privacy/page.tsx` — ~6.8 KB of legal prose. Have the Dutch reviewed; it is a legal text,
      not marketing copy.
- [ ] `drive-with-us/page.tsx`, `error.tsx`, `not-found.tsx`, `global-not-found.tsx`
- [ ] Admin: ~250 strings across nav, tables, status labels, forms, validation, audit-log event
      rendering
- [ ] `lib/email.ts` — customer mail localized by the stored `locale`; team alerts stay EN (D7)

### Phase 6 — SEO

- [ ] `generateMetadata` per locale (title, description) for all three public routes
- [ ] `alternates.languages` with `en`, `nl`, `x-default`
- [ ] `openGraph.locale` (`nl_NL` / `en_NL`) + `alternateLocale`, and localized OG image alt text
- [ ] JSON-LD in `app/[locale]/page.tsx`: `inLanguage` + localized `description`
- [ ] `sitemap.ts` — both locales, per-entry `alternates`, localized slugs
- [ ] `robots.ts` — confirm the `/admin` disallow still matches after routing changes

### Phase 7 — Verification

- [ ] Playwright parameterized over both locales (the suite already covers 6 viewports → 12 runs)
- [ ] Existing specs assert English strings (`tests/e2e/site.spec.ts`,
      `quote-flow.spec.ts`, `drivers.spec.ts`, `driver-application.spec.ts`) — drive them from the
      dictionaries rather than hardcoding, or they will only ever test one language
- [ ] CI test for empty / untranslated-identical values in `nl.json`
- [ ] Guard against new hardcoded literals under `app/[locale]/`
- [ ] Language switcher tested with JS disabled
- [ ] **Layout QA at every breakpoint.** Dutch runs 15–25% longer and this design is unusually
      exposed. Known risk spots:
      - `Request a quotation` → `Vraag een prijsopgave aan` in a `min-h-[44px]` bordered button
        at `tracking-[0.24em]` (header + hero)
      - Header tagline `THE ART OF EXECUTIVE HOSPITALITY` at 9px / `tracking-[0.42em]`
      - Section eyebrows (`I — SERVICES`, `V — ACROSS THE NETHERLANDS`) at `tracking-[0.42em]`
      - `clamp()` headlines in hero / statement / section headings
      Expect real CSS work at the `md` breakpoint, not just translation.
- [ ] `npm run lint && npm run typecheck && npm run build && npm run test:e2e`

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
- **T4 — Production migrations.** `npm run db:migrate` reads only `.env.local` (local Docker).
  Production is Supabase via `.env`. The four Phase 3 migrations need a deliberate production
  run — see the launch checklist.
- **T5 — `global-not-found.tsx`** sits outside `[locale]` and cannot use root params. The proxy
  keeps real site paths locale-prefixed, so in-site misses hit `app/[locale]/not-found.tsx`;
  the global file only catches unmatched roots.
- **T6 — CSP.** `next.config.ts` locks `connect-src` / `script-src` to this origin. The no-library
  approach needs no CSP change. Any future translation SaaS or font subset would.
- **T7 — Fonts.** `lib/fonts.ts` loads `subsets: ["latin"]`, which covers Dutch (ë, é, ij). No
  change needed — do not "fix" this.

---

## 6. Launch checklist additions

Fold into the existing checklist in `README.md`:

- [ ] Four Phase 3 migrations run against the **production** Supabase database (T4)
- [ ] ~25 flagged brand headlines reviewed by a native Dutch copywriter (D6)
- [ ] Dutch privacy policy reviewed as a legal text
- [ ] `hreflang` tags verified live on all three routes in both locales
- [ ] Both locales submitted in Search Console; `sitemap.xml` lists both
- [ ] `/` redirect verified for a Dutch browser, an English browser, and a returning visitor
      with a `NEXT_LOCALE` cookie
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

- [ ] `media-src/` + `scripts/build-brand-film.mts` — check whether the brand film carries
      burnt-in text that would need a Dutch cut. The play button is disabled until the film
      is added, so this is not blocking.
- [ ] Dutch register on `drive-with-us` — plan assumes **je**. Confirm with the client; a premium
      brand may prefer **u** even for driver recruitment.
