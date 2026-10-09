# Ecram Execs — website, quote requests & admin

Next.js 16 app containing:

- **`/`** — the public homepage (ported from the design export in `../Ecram-Execs-Website`), fully server-rendered.
- **Quote form** — the "Plan your journey" form saves each request to Postgres and emails the team.
- **`/admin`** — password-protected panel to review requests, set status, record the quoted amount and keep internal notes. Every change is logged in the request's history.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS v4 everywhere (site and admin) |
| Database | PostgreSQL (Supabase in production) via Drizzle ORM |
| Validation | Zod |
| Email | Resend, or Gmail SMTP for demos (optional — skipped and logged if not configured) |
| Hosting | Vercel |

## Project layout

```
app/
  (site)/                 public website (own root layout, fonts, CSS)
    _components/sections/ one component per homepage section
    _components/quote-form.tsx
  (admin)/admin/          admin panel (own root layout, Tailwind)
    login/  requests/[id]/  actions.ts
lib/
  db/        schema.ts (tables), index.ts (connection)
  quotes/    validation + the public submitQuote server action
  auth/      password hashing and database sessions
  admin/     admin-only queries (each checks the session)
  site-config.ts  business details shown on the website
drizzle/     SQL migrations (generated — commit them)
scripts/     create-admin.mts
tests/e2e/   Playwright end-to-end tests
proxy.ts     redirects signed-out visitors away from /admin
```

## Local development

Requires Node 20+ and Docker (or any Postgres).

```bash
npm install

# 1. A local Postgres
docker run -d --name ecram-pg -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=ecram \
  -p 127.0.0.1:54329:5432 postgres:17-alpine

# 2. Environment
cp .env.example .env.local
#    set DATABASE_URL=postgres://postgres:postgres@127.0.0.1:54329/ecram

# 3. Create the tables
npm run db:migrate

# 4. Create your admin login (prompts for a password, min 12 characters)
npm run admin:create -- you@example.com "Your Name"

# 5. Run
npm run dev        # http://localhost:3000 and http://localhost:3000/admin
```

Running `admin:create` again for an existing email resets that admin's password and signs them out everywhere.

## Styling

Everything is styled with **Tailwind CSS v4** utility classes.

- **Website theme** — `app/(site)/site.css` defines the design tokens: the `ink` colour scale (`ink-50` paper white → `ink-975` deep black, plus `error`), the fonts (`font-display` Cinzel, `font-serif` Cormorant Garamond, `font-sans` Manrope) and the breakpoints the design was built on: `xs` 381px · `sm` 481px · `md` 761px · `lg` 1001px · `xl` 1101px · `2xl` 1800px (mobile-first — e.g. `md:` applies from 761px up).
- **Effects** — the same file keeps the few things utilities can't express: the chrome text gradient, logo sheen, marquee, reveal-on-scroll, button hover fills, and the CSS-only mobile menu. Use them as classes (`chrome`, `btn-fill`, `reveal`, …).
- **Admin** — `app/(admin)/admin.css` uses Tailwind's defaults.
- The website doesn't load Tailwind's Preflight reset, because the design was built on browser defaults.

## Demo data (for client previews)

- **Website:** `lib/site-config.ts` currently holds sample business details, each marked `// DEMO`. Replace them with the real ones before launch.
- **Admin panel:** `npm run db:seed-demo` adds 12 fictional quote requests across every status, with history. Running it again replaces them. `npm run db:seed-demo -- --clear` removes them. Demo rows are tagged `source = 'demo'`, so real requests are never touched.

## Business details (phone, email, socials…)

Edit **`lib/site-config.ts`**. Every field is optional: anything left empty is hidden on the site, so no placeholder text ever reaches visitors. Phone, email, address, KvK number, fleet seating/amenities and social links all live there and flow into the footer, call buttons, privacy policy and search-engine data.

## Tests

```bash
npm run lint
npm run typecheck
npm run build && npm run test:e2e   # Playwright, against the production build
```

The end-to-end suite checks the homepage at six screen sizes (320px → 1920px), the mobile menu, the quote form (validation and a full submit → admin → quote → delete flow), admin login, the 404 page, security headers and robots/sitemap. It creates its own admin user and cleans up after itself. Locally it uses your installed Google Chrome.

GitHub Actions (`.github/workflows/ci.yml`) runs all of the above with a throwaway Postgres on every push and pull request.

## Changing the database

1. Edit `lib/db/schema.ts`
2. `npm run db:generate` — writes a new SQL file to `drizzle/`
3. `npm run db:migrate` — applies it (run against production too, see below)

`npm run db:studio` opens a browser view of the data.

## Production setup

### 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com) — choose an **EU region (Frankfurt)**.
2. *Project Settings → Database → Connection string*:
   - **Session pooler** (port 5432) → both `DATABASE_URL` and `DATABASE_URL_DIRECT`
   - Don't use the transaction pooler (port 6543): admin pages run several queries in parallel and it hangs on them
3. From your machine, with those two values in `.env.local`:
   ```bash
   npm run db:migrate
   npm run admin:create -- owner@ecramexecs.nl "Owner Name"
   ```

### 2. Resend (email alerts) — optional but recommended

1. Create an account at [resend.com](https://resend.com), add and verify your domain.
2. Create an API key.
3. Set `RESEND_API_KEY`, `EMAIL_FROM` (an address on the verified domain) and `NOTIFY_EMAIL_TO` (comma-separate several recipients).

**No domain yet (demos):** leave `RESEND_API_KEY` empty and send through Gmail instead. Turn on 2-Step Verification for the Gmail account, create an App Password, then set `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=465`, `SMTP_USER` (the Gmail address), `SMTP_PASS` (the app password) and `EMAIL_FROM="Ecram Execs <that-address@gmail.com>"`. Gmail allows about 500 emails a day. Setting `RESEND_API_KEY` later switches to Resend with no code change.

### 3. Vercel

1. Push this folder to its own GitHub repository and import it at [vercel.com/new](https://vercel.com/new) (framework: Next.js, defaults are fine).
2. *Settings → Environment Variables*: add everything from `.env.example`. Generate `IP_HASH_SALT` with `openssl rand -hex 32`.
3. *Settings → Functions → Function Region*: pick **Frankfurt (fra1)** to sit next to the database.
4. Deploy. Commercial sites need the Vercel **Pro** plan.

## Launch checklist

- [ ] Replace the `// DEMO` values in `lib/site-config.ts` (phone, email, address, KvK, seating, amenities, socials)
- [ ] Remove the demo requests: `npm run db:seed-demo -- --clear` (against the production database)
- [ ] Review the privacy policy text in `app/(site)/privacy/page.tsx` (retention period, processors)
- [ ] Supabase on the **Pro** plan (daily backups, no pausing), EU region, migrations run
- [ ] Admin accounts created with `npm run admin:create`
- [ ] Resend domain verified; `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL_TO` set — submit a test request and confirm both emails arrive
- [ ] Vercel **Pro**, function region `fra1`, all env vars set, `SITE_URL` = the final domain
- [ ] Custom domain connected (HTTPS is automatic)
- [ ] Brand film added (the play button is disabled until then)

## Security notes

- Admin passwords are hashed with scrypt; sessions are random tokens stored hashed in the database (httpOnly, secure cookie, 7 days).
- Five wrong passwords lock an account for 15 minutes.
- Every admin page, query and server action re-checks the session (`requireAdmin`); `proxy.ts` is only a fast pre-check.
- The quote form has a honeypot field and allows 5 submissions per visitor per 15 minutes. Visitor IPs are stored only as salted hashes.
- `/admin` is marked `noindex`, excluded in robots.txt and sent with `Cache-Control: private, no-store`.
- Security headers on every response: Content-Security-Policy, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy. When adding a third-party service (analytics, video embeds), extend the CSP in `next.config.ts`.
- Admins can permanently delete a request (and its history) for GDPR erasure requests.
