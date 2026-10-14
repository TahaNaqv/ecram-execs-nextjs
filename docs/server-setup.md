# Self-hosting on an Ubuntu VPS (Next.js + Postgres on the same server)

Replaces the Vercel + Supabase setup. **Everything lives on this one server**: the Postgres database and the driver
documents (stored in a private folder on disk, `DOCUMENTS_DIR`, see §6). Supabase is no longer needed; if you do want to
keep using Supabase Storage instead, leave `DOCUMENTS_DIR` empty and set the `SUPABASE_*` variables.

Replace `example.nl` with the real domain throughout. Commands starting `sudo` run as an admin user on
the server; the app itself runs as an unprivileged `ecram` user. Nothing in this guide has been run on
your server yet.

**Order of work:** build and test the new server on its IP address first (§1–§8, no DNS change, the live
site is untouched) → rehearse the data move (§9) → cutover on a quiet moment (§11) → DNS (§12).

## 0. What you need

- Ubuntu 22.04/24.04 VPS, **≥ 2 vCPU and 4 GB RAM** (`next build` needs ~2 GB; with 2 GB RAM add 2 GB swap, §1). 40 GB disk.
- The server's public IPv4 address, and SSH access as a sudo user (key-based).
- GoDaddy login for the domain (§12).
- The repo is public, so the server clones it over HTTPS (§5).
- Your Resend key and sending address (and `IP_HASH_SALT` if you are moving an existing site).

## 1. Base system and firewall

```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install ufw fail2ban unattended-upgrades git curl ca-certificates build-essential nginx
sudo dpkg-reconfigure -plow unattended-upgrades          # accept: automatic security updates

# Firewall: SSH, HTTP, HTTPS only. Postgres is never exposed.
sudo ufw allow OpenSSH && sudo ufw allow 'Nginx Full' && sudo ufw --force enable

# Only if the server has 2 GB RAM or less: swap so the build doesn't get killed
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Harden SSH if it isn't already: key login only (`PasswordAuthentication no` in `/etc/ssh/sshd_config`,
then `sudo systemctl reload ssh`). **Keep a second SSH session open while you change this.**

## 2. Node.js 24

The repo pins Node 24 (`.nvmrc`); Ubuntu's own package is older (Node 22). Install the official build for the pinned
version into `/usr/local`, checking its checksum (the systemd unit expects `/usr/local/bin/node`):

```bash
V=v24.21.0; cd /tmp
curl -fsSLO https://nodejs.org/dist/$V/node-$V-linux-x64.tar.xz && curl -fsSLO https://nodejs.org/dist/$V/SHASUMS256.txt
grep " node-$V-linux-x64.tar.xz$" SHASUMS256.txt | sha256sum -c -        # must say: OK
sudo tar -xJf node-$V-linux-x64.tar.xz -C /usr/local --strip-components=1 --no-same-owner
node -v        # v24.21.0
```

## 3. PostgreSQL

Ubuntu 26.04 ships PostgreSQL 18, which is fine for this app (CI uses 17; nothing here is version-specific). On an older Ubuntu use the PGDG repo for 17.

```bash
sudo apt -y install postgresql          # 18 on Ubuntu 26.04
```

Create the database and a dedicated login. Generate the password first (`openssl rand -base64 24`) and keep it:

```bash
sudo -u postgres psql <<'SQL'
create role ecram login password 'PASTE-THE-GENERATED-PASSWORD';
create database ecram owner ecram encoding 'UTF8';
SQL
```

Postgres listens on localhost only by default (`listen_addresses = 'localhost'`); leave it that way. The app
connects with `postgres://ecram:PASSWORD@127.0.0.1:5432/ecram`. If the password has symbols, URL-encode them.

## 4. The `ecram` user and app folder

```bash
sudo adduser --system --group --home /home/ecram --shell /bin/bash ecram
sudo mkdir -p /srv/ecram-execs && sudo chown ecram:ecram /srv/ecram-execs
```

Let `ecram` restart only its own service (used by `scripts/deploy.sh`):

```bash
echo 'ecram ALL=(root) NOPASSWD: /usr/bin/systemctl restart ecram-execs' | sudo tee /etc/sudoers.d/ecram-execs
sudo chmod 440 /etc/sudoers.d/ecram-execs
```

## 5. Get the code

The repository is public, so the server clones it over HTTPS — no deploy key needed. (If it is ever made private, add a
read-only deploy key and switch the remote to SSH.)

```bash
sudo -u ecram git clone https://github.com/TahaNaqv/ecram-execs-nextjs.git /srv/ecram-execs
```

## 6. Environment file

```bash
sudo -u ecram cp /srv/ecram-execs/.env.example /srv/ecram-execs/.env
sudo -u ecram chmod 600 /srv/ecram-execs/.env
sudo -u ecram nano /srv/ecram-execs/.env
```

Set at least:

| Variable | Value |
|---|---|
| `DATABASE_URL` and `DATABASE_URL_DIRECT` | `postgres://ecram:PASSWORD@127.0.0.1:5432/ecram` (both the same here) |
| `SITE_URL` | `https://example.nl` |
| `DOCUMENTS_DIR` | `/var/lib/ecram-execs/documents` — where driver documents are stored (create it first, below). Download and upload links are signed with a key derived from `DOCUMENTS_SECRET` (or `IP_HASH_SALT` if that is unset): **treat it as a secret and don't rotate it casually** (links in use stop working). Optional: `DOCUMENTS_MIN_FREE_MB` (default 2048) — uploads are refused when free disk would fall below this. |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL_TO` | unchanged; the sending domain must be verified in Resend |
| `IP_HASH_SALT` | copy the current value (or `openssl rand -hex 32` for a new one — rate-limit history just resets) |
| `CORPORATE_OTP_SECRET` | **new**: `openssl rand -hex 32` |
| `KVK_API_KEY` | optional, when issued |

Create the documents folder (private to the app user, outside the git checkout so a deploy never touches it):

```bash
sudo install -d -m 700 -o ecram -g ecram /var/lib/ecram-execs /var/lib/ecram-execs/documents
```

Remove the Gmail `SMTP_*` lines if Resend is configured. Values with spaces need quotes
(`EMAIL_FROM="Ecram Execs <bookings@example.nl>"`). `.env` is git-ignored and must never be committed.

## 7. Install, migrate, build

First time only — the database is empty, so this creates the whole schema (migrations 0000–0007):

```bash
cd /srv/ecram-execs
sudo -u ecram npm ci --no-audit --no-fund
sudo -u ecram npm run db:migrate:prod                 # dry run: host should be 127.0.0.1, 8 pending
sudo -u ecram npm run db:migrate:prod -- --apply
sudo -u ecram npm run build
```

> If you are going to restore existing data (§9), **skip the `--apply` above** — restore first, then migrate.

Create an admin login (only if you are *not* restoring existing admin users):

```bash
sudo -u ecram node --env-file=.env scripts/create-admin.mts you@example.nl "Your Name"
```

## 8. Run it as a service, behind nginx

```bash
sudo cp /srv/ecram-execs/deploy/ecram-execs.service /etc/systemd/system/
sudo systemctl daemon-reload && sudo systemctl enable --now ecram-execs
systemctl status ecram-execs --no-pager
curl -I http://127.0.0.1:3000/en            # 200

sudo cp /srv/ecram-execs/deploy/nginx-ecram-execs.conf /etc/nginx/sites-available/ecram-execs
sudo sed -i 's/example\.nl/YOUR-DOMAIN/g' /etc/nginx/sites-available/ecram-execs
sudo ln -s /etc/nginx/sites-available/ecram-execs /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

Test through nginx **before DNS**, using the server IP and a Host header:

```bash
curl -I -H 'Host: example.nl' http://SERVER-IP/en        # 200, with the security headers
```

Logs: `journalctl -u ecram-execs -f` (app), `/var/log/nginx/error.log`.

> **Do not start the app with `-H 127.0.0.1`.** With the host bound that way, Next.js rewrites the translated Dutch URLs
> to itself and `/nl/rijd-met-ons` / `/nl/zakelijke-partner` answer with a redirect loop (found on the real server).
> The firewall (default-deny) keeps port 3000 closed to the internet instead.

## 9. (Optional) Move existing data from Supabase

> **Skip this section for a fresh start.** It applies only when an existing Supabase database has data to carry over.
> Driver documents already in Supabase Storage are not covered by it (they would need copying into `DOCUMENTS_DIR`).

You need Supabase's **session pooler** connection string (port 5432, same as in the old `.env`). The server's `pg_dump` (installed with PostgreSQL in §3) must be at least as new as Supabase's Postgres; 18 is.

```bash
# On the new server. The password is in the connection string, so keep this out of shell history/shared logs.
export OLD='postgres://postgres.XXXX:PASSWORD@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'
pg_dump "$OLD" --format=custom --no-owner --no-privileges --schema=public --schema=drizzle -f /tmp/ecram.dump
ls -lh /tmp/ecram.dump

# Restore into the empty `ecram` database (do this INSTEAD of §7's --apply)
export NEW='postgres://ecram:PASSWORD@127.0.0.1:5432/ecram'
pg_restore --no-owner --no-privileges --dbname="$NEW" /tmp/ecram.dump
```

An error that `schema "public" already exists` is expected and harmless. After the restore, the migration
history is Supabase's (0000–0006), so the migrate step applies only 0007:

```bash
cd /srv/ecram-execs
sudo -u ecram npm run db:migrate:prod                 # exactly ONE pending: 0007_corporate_partner
sudo -u ecram npm run db:migrate:prod -- --apply
```

Verify the data arrived (compare with the same queries on Supabase):

```bash
psql "$NEW" -c "select 'quote_requests', count(*) from quote_requests union all select 'driver_applications', count(*) from driver_applications union all select 'admin_users', count(*) from admin_users union all select 'drivers', count(*) from drivers union all select 'request_events', count(*) from request_events;"
psql "$NEW" -c "select count(*) from drizzle.__drizzle_migrations;"      # 8
```

Then restart the app (`sudo systemctl restart ecram-execs`), sign in at `/admin` on the new server, open a
couple of old requests and a driver application with documents. **Delete `/tmp/ecram.dump` when done** (it
contains personal data): `shred -u /tmp/ecram.dump`.

The first run is a **rehearsal**: it shows the steps work and how long the dump takes. Redo it at cutover (§11)
so no requests submitted in between are lost.

## 10. HTTPS and backups

DNS must already point at this server before HTTPS (§12). Then:

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d example.nl -d www.example.nl --redirect --agree-tos -m you@example.nl
sudo certbot renew --dry-run                        # renewal is automatic via a systemd timer
```

Check that `X-Forwarded-For` handling survived certbot's edit: `sudo nginx -T | grep -n X-Forwarded-For`
should show the `$remote_addr` lines in the HTTPS block as well.

Nightly backup (14 days kept locally): the database dump (run as `postgres`) and the driver documents (a tar of
`/var/lib/ecram-execs/documents`, which only root can read — so the script is also run from root's cron):

```bash
sudo mkdir -p /var/backups/ecram && sudo chown postgres:postgres /var/backups/ecram
sudo cp /srv/ecram-execs/deploy/backup-db.sh /usr/local/bin/ecram-backup && sudo chmod 755 /usr/local/bin/ecram-backup
# Separate log files: each user's cron appends to its own (a shared one owned by the other user would break the job)
sudo install -o postgres -g postgres -m 644 /dev/null /var/log/ecram-backup-db.log
echo '15 2 * * * /usr/local/bin/ecram-backup >> /var/log/ecram-backup-db.log 2>&1' | sudo crontab -u postgres -
echo '30 2 * * * /usr/local/bin/ecram-backup >> /var/log/ecram-backup-docs.log 2>&1' | sudo crontab -u root -
sudo -u postgres /usr/local/bin/ecram-backup            # run once now to prove it works
sudo /usr/local/bin/ecram-backup                        # root run: also writes the documents archive
```

Remove abandoned uploads nightly (a document is uploaded before the application is saved, so an applicant who closes
the tab leaves scans behind). Try it as a dry run first:

```bash
cd /srv/ecram-execs && sudo -u ecram node --env-file=.env scripts/sweep-documents.mts
echo '45 3 * * * cd /srv/ecram-execs && node --env-file=.env scripts/sweep-documents.mts --apply >> /home/ecram/sweep.log 2>&1' | sudo crontab -u ecram -
```

Nginx logs requests without query strings (`/var/log/nginx/ecram.access.log`), so the signed tokens in document links
never land in a log. Backups keep a deleted document for up to 14 days; that is the retention to state in your privacy policy.

**A backup on the same machine is not enough**: also copy `/var/backups/ecram` somewhere else (another server
via `rsync`, or a cloud bucket) — and do a test restore into a scratch database once.

## 11. Cutover (day of the switch)

1. A day before: lower the DNS TTL on GoDaddy (§12) to 10 minutes, so the switch propagates quickly.
2. Pick a quiet hour. **Stop writes on the old site** (e.g. pause/disable the Vercel project, or put up a temporary page) so nothing is submitted while you copy.
3. Repeat §9 against an **empty** database (drop and recreate it: `sudo -u postgres psql -c 'drop database ecram' -c "create database ecram owner ecram encoding 'UTF8'"`), restore, migrate (0007), restart.
4. Smoke-test on the IP (§13).
5. Switch DNS (§12). Get HTTPS (§10) as soon as the domain resolves to the new server.
6. Leave the old Vercel/Supabase project untouched for a week as a fallback. Don't delete anything until the new server has run cleanly through a few days of real traffic and a backup restore has been tested.

## 12. GoDaddy DNS → the server

GoDaddy → **My Products → your domain → DNS** (Manage DNS).

| Type | Name | Value | TTL |
|---|---|---|---|
| **A** | `@` | `SERVER-IPV4` | 10 min (600 s) before cutover, 1 h after |
| **CNAME** | `www` | `@` | same |
| *(only if the server has IPv6)* AAAA | `@` | `SERVER-IPV6` | same |

Steps and cautions:

- **Edit the existing `@` A record** (it may say "Parked", or hold Vercel's `76.76.21.21`) and the existing `www` CNAME (often `cname.vercel-dns.com`); don't add duplicates. A name can have only one CNAME, and a CNAME can't coexist with an A record on the same name.
- **Do not touch `MX`, `TXT` (SPF, DKIM, DMARC, domain verification) or Resend/other `CNAME` records.** They run the email; deleting them breaks mail and Resend's verified domain.
- If GoDaddy "Forwarding" is switched on for the domain, turn it off — it overrides DNS.
- Check propagation: `dig +short example.nl A` and `dig +short www.example.nl` should show the server IP (also try `dig @8.8.8.8 …`). Allow minutes to a few hours. GoDaddy's own nameservers are authoritative, so no nameserver change is needed.
- Once it resolves, run certbot (§10) and open `https://example.nl`.

## 13. Smoke test after cutover

- [ ] `https://example.nl` and `https://www.example.nl` load over HTTPS; `http://` redirects.
- [ ] `/en`, `/nl`, `/en/privacy`, `/en/drive-with-us`, `/en/corporate-partner` all load; language switch works.
- [ ] Submit a quote; the team alert and customer confirmation emails arrive.
- [ ] Corporate Partner: the six-digit code email arrives within a minute (see `docs/rollout-corporate-partner.md` §4).
- [ ] `/admin` login works; restored requests are visible; a driver application's documents open.
- [ ] Rate limiting sees real visitor IPs: in the DB, `select ip_hash from quote_requests order by created_at desc limit 3` should differ between visitors (not all the same hash).
- [ ] `curl -sI https://example.nl | grep -i -E 'strict-transport|content-security'` shows the security headers.
- [ ] Both `sudo systemctl is-enabled ecram-execs` and `postgresql` say `enabled` (they survive a reboot): reboot once and re-check.

## 14. Day-to-day

Deploy an update (as `ecram`, in `/srv/ecram-execs`):

```bash
./scripts/deploy.sh                       # pull, install, show pending migrations, build, restart
APPLY_MIGRATIONS=1 ./scripts/deploy.sh    # same, and apply them (read the list first)
```

Roll back code: `git checkout <previous-commit>` (or `git revert`), `npm ci && npm run build`, `sudo systemctl restart ecram-execs`.
Migrations are additive and are not undone by rolling back code.

Useful: `journalctl -u ecram-execs --since '1 hour ago'`, `sudo systemctl restart ecram-execs`, `sudo nginx -t`,
`df -h`, `free -m`, `sudo -u postgres psql ecram`.

## 15. Things this setup no longer does for you (Vercel did)

- **Backups, patching and uptime are now yours.** Unattended security updates (§1) and the nightly dump (§10) cover the basics; add an uptime monitor (e.g. UptimeRobot on the homepage) so you hear about an outage first.
- **No automatic deploys.** Pushing to GitHub doesn't update the server; run the deploy script (or add a GitHub Action later).
- **No preview deployments** and no CDN: static assets are served by this one server. The `/assets/*` cache headers are set by the app; if traffic grows, put Cloudflare in front.
- **Only one server** — a reboot or `next build` memory spike means brief downtime. The deploy script restarts quickly, but it is not zero-downtime.
