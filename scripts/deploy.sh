#!/usr/bin/env bash
# Update the app on the server. Run as the `ecram` user from /srv/ecram-execs:
#
#   ./scripts/deploy.sh                      # pull, install, build, restart
#   APPLY_MIGRATIONS=1 ./scripts/deploy.sh   # …and apply pending migrations first, after you've read the list
#
# Migrations are applied only when you say so, the same rule as `npm run db:migrate:prod`. If any are pending and you
# have not said so, the script stops before it builds or restarts anything: new code that expects a column the database
# does not have would fail on every page that reads it, so the site keeps running the previous version until you decide.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Fetching main"
git fetch origin main
git checkout main
git merge --ff-only origin/main

echo "→ Installing dependencies"
npm ci --no-audit --no-fund

echo "→ Pending migrations (dry run)"
PLAN=$(mktemp)
trap 'rm -f "$PLAN"' EXIT
npm run db:migrate:prod 2>&1 | tee "$PLAN"

if [ "${APPLY_MIGRATIONS:-0}" = "1" ]; then
  echo "→ Applying migrations"
  npm run db:migrate:prod -- --apply
elif grep -q '^ *pending:' "$PLAN"; then
  echo
  echo "✗ Stopping before the build. The migrations listed above are pending and this code needs them."
  echo "  Nothing was built or restarted: the site is still running the previous version."
  echo "  Read the list, then run:  APPLY_MIGRATIONS=1 ./scripts/deploy.sh"
  exit 1
fi

echo "→ Building"
npm run build

echo "→ Restarting"
sudo systemctl restart ecram-execs
sleep 3
systemctl is-active --quiet ecram-execs && echo "✓ ecram-execs is running ($(git rev-parse --short HEAD))"
curl -fsS -o /dev/null -w "✓ homepage answered %{http_code}\n" http://127.0.0.1:3000/en
