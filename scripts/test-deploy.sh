#!/usr/bin/env bash
# Tries the build / swap / rollback steps of scripts/deploy.sh in a scratch folder, with stand-ins for npm, git, systemctl and the
# health check, so the safety rules can be checked without a server:   bash scripts/test-deploy.sh
set -uo pipefail
here=$(cd "$(dirname "$0")" && pwd)
source "$here/deploy.sh"   # only defines the functions: main runs when the script is executed
set +e                      # (the script stops on any error; here a step is expected to fail now and then)

pass=0 fail=0
check() { # check "description" command...
  local what=$1; shift
  if "$@"; then pass=$((pass + 1)); echo "  ok   $what"; else fail=$((fail + 1)); echo "  FAIL $what"; fi
}
marker() { cat "$1/marker" 2>/dev/null; }

# Stand-ins
RESTARTS=0
restart_service() { RESTARTS=$((RESTARTS + 1)); }
git() { return 0; }
HEALTHY=1
healthy() { [ "$HEALTHY" = 1 ] && [ "$(marker .next)" = "new" ]; }  # the stand-in site is healthy when the new build is live
BUILD_WORKS=1
npm() { # `npm run build` writes a build to the folder it was told to use, or fails halfway like a broken build
  mkdir -p "$NEXT_DIST_DIR"
  if [ "$BUILD_WORKS" = 1 ]; then echo new > "$NEXT_DIST_DIR/marker"; else echo broken > "$NEXT_DIST_DIR/marker"; return 1; fi
}

fresh() { # a scratch app folder whose live build is "old", with an image cache in it
  work=$(mktemp -d); cd "$work"
  mkdir -p .next/cache/images; echo old > .next/marker; echo resized > .next/cache/images/a.webp
  RESTARTS=0; HEALTHY=1; BUILD_WORKS=1
}

echo "A build that fails changes nothing"
fresh; BUILD_WORKS=0
build_aside; status=$?
check "the build reports failure" test "$status" -ne 0
check "the live build is untouched" test "$(marker .next)" = old
check "the half-built folder is removed" test ! -e "$BUILD_DIR"
check "the service was not restarted" test "$RESTARTS" -eq 0

echo "A good build is swapped in, and the old one kept"
fresh
build_aside; status=$?
check "the build reports success" test "$status" -eq 0
check "the live build is still the old one until the swap" test "$(marker .next)" = old
swap_in; restart_service
check "the new build is live" test "$(marker .next)" = new
check "the old build is kept for a rollback" test "$(marker "$PREVIOUS_DIR")" = old
check "the resized pictures came along" test -f .next/cache/images/a.webp
check "the build folder is gone" test ! -e "$BUILD_DIR"
check "the service was restarted once" test "$RESTARTS" -eq 1
check "the new version counts as healthy" healthy

echo "A new version that does not come up is rolled back"
fresh
build_aside; swap_in; restart_service
HEALTHY=0
if healthy; then check "unhealthy is detected" false; else check "unhealthy is detected" true; fi
rollback
check "the old build is live again" test "$(marker .next)" = old
check "the bad build is kept for inspection" test "$(marker "$FAILED_DIR")" = new
check "the previous-build slot is empty again" test ! -e "$PREVIOUS_DIR"
check "the service was restarted for the rollback too" test "$RESTARTS" -eq 2

echo "A rollback with nothing to go back to says so"
fresh
rollback >/dev/null; status=$?
check "it fails" test "$status" -ne 0
check "the live build is untouched" test "$(marker .next)" = old
check "the service was not restarted" test "$RESTARTS" -eq 0

echo "A second deploy replaces the kept build, not the live one"
fresh
build_aside; swap_in
build_aside; swap_in
check "the live build is the newest" test "$(marker .next)" = new
check "only one previous build is kept" test "$(ls -d .next-* | wc -l | tr -d ' ')" -eq 1

echo "The disk check refuses when too little is free"
fresh
MIN_FREE_MB=999999999 enough_disk; status=$?
check "not enough disk is refused" test "$status" -ne 0
MIN_FREE_MB=1 enough_disk; status=$?
check "enough disk is accepted" test "$status" -eq 0

echo
echo "$pass passed, $fail failed"
[ "$fail" -eq 0 ]
