#!/usr/bin/env bash
# Update the app on the server. Run as the `ecram` user from /srv/ecram-execs:
#
#   ./scripts/deploy.sh                      # pull, install if needed, build aside, swap in, restart, check
#   APPLY_MIGRATIONS=1 ./scripts/deploy.sh   # …and apply pending migrations first, after you've read the list
#   ./scripts/deploy.sh --rollback           # put the previous build back (the one before the last deploy)
#
# The site never serves from a build that is being written. The new version is built into .next-build while the running
# one keeps serving from .next; only when that build has succeeded are the folders swapped and the service restarted. If the
# build fails, nothing has changed: the site is still on the previous version. If the new version does not come up healthy
# (the service running, the home page answering, every script and stylesheet it links to fetchable), the previous build is put
# back and restarted. The previous build stays in .next-previous after a good deploy, for --rollback.
#
# Migrations are applied only when you say so, the same rule as `npm run db:migrate:prod`. If any are pending and you
# have not said so, the script stops before it builds or restarts anything: new code that expects a column the database
# does not have would fail on every page that reads it, so the site keeps running the previous version until you decide.
#
# Dependencies are installed only when package.json or package-lock.json changed since the last install (FORCE_INSTALL=1 to
# install anyway): `npm ci` empties node_modules first, and the running site reads from it.
set -euo pipefail

SERVICE=${SERVICE:-ecram-execs}
HEALTH_URL=${HEALTH_URL:-http://127.0.0.1:3000}
BUILD_DIR=.next-build
PREVIOUS_DIR=.next-previous
FAILED_DIR=.next-failed
MIN_FREE_MB=${MIN_FREE_MB:-1500}

restart_service() {
  sudo systemctl restart "$SERVICE"
}

# 0 when the service runs, the home page answers, and every script and stylesheet it links to can be fetched: a build whose
# files are missing answers the page but not the files, which is what a broken deploy looks like to a visitor.
healthy() {
  local tries=${1:-10} html asset ok i
  for ((i = 1; i <= tries; i++)); do
    if systemctl is-active --quiet "$SERVICE" && html=$(curl -fsS --max-time 15 "$HEALTH_URL/en" 2>/dev/null); then
      ok=1
      for asset in $(printf '%s' "$html" | grep -o '/_next/static/[^"]*\.\(js\|css\)' | sort -u); do
        curl -fsS -o /dev/null --max-time 15 "$HEALTH_URL$asset" 2>/dev/null || { ok=0; break; }
      done
      if [ "$ok" = 1 ]; then return 0; fi
    fi
    sleep 2
  done
  return 1
}

enough_disk() {
  local free
  free=$(df -Pm . | awk 'NR==2 { print $4 }')
  [ "${free:-0}" -ge "$MIN_FREE_MB" ]
}

lock_sum() {
  cat package.json package-lock.json | { sha256sum 2>/dev/null || shasum -a 256; } | cut -d' ' -f1
}

install_dependencies() {
  local sum
  sum=$(lock_sum)
  if [ "${FORCE_INSTALL:-0}" != "1" ] && [ -f node_modules/.deploy-lock-sum ] && [ "$(cat node_modules/.deploy-lock-sum)" = "$sum" ]; then
    echo "→ Dependencies unchanged"
    return 0
  fi
  echo "→ Installing dependencies"
  npm ci --no-audit --no-fund
  printf '%s' "$sum" > node_modules/.deploy-lock-sum
}

# Builds into $BUILD_DIR. Next adds that folder to tsconfig.json while it does; that file is put back either way.
build_aside() {
  rm -rf "$BUILD_DIR"
  if NEXT_DIST_DIR="$BUILD_DIR" npm run build; then
    git checkout -- tsconfig.json
    return 0
  fi
  git checkout -- tsconfig.json 2>/dev/null || true
  rm -rf "$BUILD_DIR"
  return 1
}

# The new build becomes .next, the one it replaces becomes .next-previous. The pictures the image optimiser has already resized
# come along, so the first visitors after a deploy do not all wait for them.
swap_in() {
  rm -rf "$PREVIOUS_DIR" "$FAILED_DIR"
  if [ -d .next ]; then mv .next "$PREVIOUS_DIR"; fi
  mv "$BUILD_DIR" .next
  if [ -d "$PREVIOUS_DIR/cache/images" ]; then
    mkdir -p .next/cache
    cp -a "$PREVIOUS_DIR/cache/images" .next/cache/images
  fi
}

# The previous build back in place (the one that was just swapped in is kept as .next-failed) and the service restarted.
rollback() {
  if [ ! -d "$PREVIOUS_DIR" ]; then
    echo "✗ There is no previous build to go back to ($PREVIOUS_DIR)."
    return 1
  fi
  rm -rf "$FAILED_DIR"
  if [ -d .next ]; then mv .next "$FAILED_DIR"; fi
  mv "$PREVIOUS_DIR" .next
  restart_service
}

main() {
  cd "$(dirname "$0")/.."

  if [ "${1:-}" = "--rollback" ]; then
    echo "→ Putting the previous build back"
    rollback
    if healthy; then
      echo "✓ $SERVICE is running on the previous build"
    else
      echo "✗ The previous build does not come up cleanly either: see  journalctl -u $SERVICE"
      exit 1
    fi
    return 0
  fi

  echo "→ Fetching main"
  git fetch origin main
  git checkout main
  git merge --ff-only origin/main

  install_dependencies

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

  if ! enough_disk; then
    echo "✗ Less than ${MIN_FREE_MB} MB of disk is free: not building. The site is still running the previous version."
    exit 1
  fi

  echo "→ Building into $BUILD_DIR (the site keeps running from .next meanwhile)"
  if ! build_aside; then
    echo
    echo "✗ The build failed. Nothing was changed: the site is still running the previous version."
    exit 1
  fi

  echo "→ Swapping in the new build and restarting"
  swap_in
  restart_service

  if healthy; then
    echo "✓ $SERVICE is running ($(git rev-parse --short HEAD))"
    curl -fsS -o /dev/null -w "✓ homepage answered %{http_code}\n" "$HEALTH_URL/en"
    echo "  The previous build is kept in $PREVIOUS_DIR:  ./scripts/deploy.sh --rollback  puts it back."
  else
    echo
    echo "✗ The new version did not come up cleanly. Putting the previous build back."
    if rollback && healthy; then
      echo "✓ $SERVICE is running on the previous build again. The new build is in $FAILED_DIR for inspection."
    else
      echo "✗ The previous build does not come up cleanly either: see  journalctl -u $SERVICE"
    fi
    exit 1
  fi
}

# Run only when executed, so scripts/test-deploy.sh can load the functions above and try them with stand-ins
if [ "${BASH_SOURCE[0]}" = "$0" ]; then
  main "$@"
fi
