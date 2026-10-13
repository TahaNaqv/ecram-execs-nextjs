# Production rollout — fleet pages, Corporate Partner, company search

Commit `04e375a` (and the three before it) are on `main`. This is the order to put them live.
Nothing here has been run against production; every step that writes says so.

**Why the order matters:** the migration is additive (new tables, new nullable columns), so it can
run *before* the deploy without breaking the live site, and the new code can't run *without* it
(the quote form now writes `vehicle`, and the Corporate Partner page reads three new tables).
Migration first, deploy second. Never the reverse. See `docs/i18n-en-nl-plan.md` §5z for why the
migration step is deliberate.

## 0. Before you start (5 min)

- [ ] `git log origin/main --oneline -1` shows `04e375a` (the push worked).
- [ ] The Vercel deployment for that commit **built successfully** (or will once the variables below are set). The build does not need the database.
- [ ] Supabase is on a plan with daily backups (README launch checklist). Take a manual backup / note the time before migrating.
- [ ] You have the production connection strings: **session pooler, port 5432** (not 6543) in `.env`
      as `DATABASE_URL` and `DATABASE_URL_DIRECT`. `.env` is git-ignored and is not on this machine yet.

## 1. Environment variables (Vercel → Settings → Environment Variables)

| Variable | Required | Value / notes |
|---|---|---|
| `CORPORATE_OTP_SECRET` | **Yes** — without it no code can be issued and the Corporate Partner page shows "could not send the code" | `openssl rand -hex 32`. Production **and** Preview. Generate it once, store it in your password manager. Changing it later invalidates any code sent in the last 10 minutes — harmless. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL_TO` | **Yes** for codes to arrive | The sending domain in `EMAIL_FROM` must be **verified in Resend**. The Gmail demo SMTP path is too slow/unreliable for a 10-minute code. |
| `SITE_URL` | Already set | Must be the final domain. |
| `KVK_API_KEY` | No | Company search. Absent → the company field is a plain text box. Apply at developers.kvk.nl; start with `KVK_API_BASE=https://api.kvk.nl/test/api` on **Preview only** to validate the integration, never on Production. |

Env var changes need a **redeploy** to take effect. Do not paste secrets into chat or commit them.

## 2. Migrate the production database (writes to production)

Run on your own machine, with the production values in `.env`. The commands are in `package.json`.

```bash
# 2a. Dry run — shows the host it will touch and the pending file. Writes nothing.
npm run db:migrate:prod
```

Check the output before continuing:
- The host is the **Supabase** host, flagged `*** NOT LOCAL ***` (that is correct here).
- Exactly **one** pending migration: `0007_corporate_partner`. If it lists more, stop and compare with `drizzle/`.
- If the pre-flight complains about `quote_requests.service` values, stop (that check predates this migration and should pass).

```bash
# 2b. Apply — this is the write. Only after 2a looks right.
npm run db:migrate:prod -- --apply
```

It verifies afterwards that the migration record moved by exactly one. Then confirm independently
(Supabase → SQL editor):

```sql
select count(*) from drizzle.__drizzle_migrations;            -- 8 (was 7)
select table_name from information_schema.tables
 where table_name in ('corporate_contacts','corporate_challenges','corporate_access'); -- 3 rows
select column_name from information_schema.columns
 where table_name = 'quote_requests' and column_name in ('vehicle','entity_kvk','corporate_contact_id'); -- 3 rows
select column_name from information_schema.columns
 where table_name = 'corporate_challenges' and column_name like 'pending_%'; -- 3 rows
```

Existing rows are untouched: all new `quote_requests` columns are nullable.

## 3. Deploy

1. Confirm the variables in §1 are set for **Production**.
2. Promote/redeploy `main` (Vercel deploys on push; if the push predated the variables, trigger a redeploy).
3. Function region stays `fra1` (next to the database).

## 4. Smoke test on the real domain (≈15 min) — use your own email

1. `/en/corporate-partner` → request a code with **your own** address. **The email must arrive within a minute.** If it doesn't: Resend dashboard → Logs (domain verified? `EMAIL_FROM` on that domain?), and Vercel function logs for `[corporate]`.
2. Enter the code → the account form appears. Submit it. A team alert should arrive at `NOTIFY_EMAIL_TO`, and the request should appear in `/admin` (source `website-corporate`) and under `/admin/corporate`.
3. Repeat in `/nl/zakelijke-partner` and confirm the email is Dutch.
4. Wrong code ×5 → locked message. Wait for / request a new code → works.
5. Home page: Fleet section → **Book** on a vehicle → page scrolls to the quote form with that vehicle selected. Submit a quote, confirm `vehicle` shows in the admin request.
6. `/api/companies?q=a` → `400`; `?q=orion` → `200` (with `available:false` until a KvK key is set).
7. Bespoke form and the home page still submit normally.

**Clean up afterwards** (the test rows are real data and your address is now on the contact list):
- Delete the test requests in the admin (Delete on the request page).
- Supabase SQL editor: `delete from corporate_contacts where email = 'you@yourdomain';` (challenges/access rows cascade).

## 5. Rollback

- **Code:** redeploy the previous Vercel deployment (before `04e375a`). The old code ignores the new tables/columns, so nothing breaks. The old quote form writes `vehicle_class`, which still exists.
- **Database:** leave the additive migration in place. Dropping the tables is unnecessary and `drizzle-kit` has no down-migrations here. If it must go, do it by hand in the SQL editor after a backup, in this order: `corporate_access`, `corporate_challenges`, drop the FK + column `corporate_contact_id` on `quote_requests`, `corporate_contacts`, then `vehicle` and `entity_kvk`. Then delete journal entry 7 only if you also delete the row from `drizzle.__drizzle_migrations`.
- **Corporate Partner only:** remove/unset `CORPORATE_OTP_SECRET` and the page fails closed (no codes issued). To hide the entry point, point the "Become A Corporate Partner" link (`who-we-serve.tsx`) back at `#enquire`.

## 6. After it is live

- [ ] Add the KvK key once issued: Preview first (`KVK_API_BASE` test URL), then Production (unset `KVK_API_BASE`), redeploy, retest §4.6 and type a real company name in the bespoke form. The request shape was written from documentation and tested only against a mock.
- [ ] Marketing consent withdrawal is manual today (edit `corporate_contacts.marketing_consent` in SQL). Decide whether to add an admin control.
- [ ] Legal read of the new privacy section (§8, EN + NL) and the consent checkbox wording.
- [ ] Native Dutch review of the new Dutch copy.
- [ ] Vehicle specs: fill `specs` in `lib/fleet/vehicles.ts` once models and manufacturer figures are confirmed (each needs `verified.source/url/checkedOn/by`); only then do the specification answers appear.
- [ ] Real fleet photos (up to 8 each) and 8 destination photos (add Eindhoven's image to `lib/site-config.ts` `destinations`).
- [ ] Run the e2e suite once against a local Postgres: `CORPORATE_OTP_SECRET=… npm run test:e2e` (the Corporate Partner spec skips without the secret). It has not been run yet.
