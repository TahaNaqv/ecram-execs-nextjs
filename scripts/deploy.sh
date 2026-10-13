#!/usr/bin/env bash
# Update the app on the server. Run as the `ecram` user from /srv/ecram-execs:
#
#   ./scripts/deploy.sh                      # pull, install, build, restart (shows pending migrations, applies none)
#   APPLY_MIGRATIONS=1 ./scripts/deploy.sh   # …and applies them, after you've read the list
#
# Migrations are applied only when you say so, the same rule as `npm run db:migrate:prod`.
set -euo pipefail
cd "$(dirname "$0")/.."

echo "→ Fetching main"
git fetch origin main
git checkout main
git merge --ff-only origin/main

echo "→ Installing dependencies"
npm ci --no-audit --no-fund

echo "→ Pending migrations (dry run)"
npm run db:migrate:prod

if [ "${APPLY_MIGRATIONS:-0}" = "1" ]; then
  echo "→ Applying migrations"
  npm run db:migrate:prod -- --apply
else
  echo "   (not applied — re-run with APPLY_MIGRATIONS=1 once you've checked the list above)"
fi

echo "→ Building"
npm run build

echo "→ Restarting"
sudo systemctl restart ecram-execs
sleep 3
systemctl is-active --quiet ecram-execs && echo "✓ ecram-execs is running ($(git rev-parse --short HEAD))"
curl -fsS -o /dev/null -w "✓ homepage answered %{http_code}\n" http://127.0.0.1:3000/en
