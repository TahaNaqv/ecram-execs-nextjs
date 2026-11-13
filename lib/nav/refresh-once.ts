"use client";

/**
 * One router refresh at a time.
 *
 * A second `router.refresh()` while the previous RSC stream is still open aborts that stream.
 * Next then throws `TypeError: network error` into the nearest error boundary, which is the
 * full-page "Something went wrong" screen. A normal reload asks again and succeeds.
 *
 * Calls that arrive during the quiet window are coalesced into one refresh when it ends,
 * so a poll and a save both land without cancelling each other.
 */
const QUIET_MS = 10_000;
let lastRefresh = 0;
let pending: ReturnType<typeof setTimeout> | null = null;
let pendingRouter: { refresh: () => void } | null = null;

function run(router: { refresh: () => void }) {
  lastRefresh = Date.now();
  pending = null;
  pendingRouter = null;
  try {
    router.refresh();
  } catch (error) {
    console.error("[refresh] threw before the request started", error);
  }
}

export function refreshOnce(router: { refresh: () => void }) {
  const wait = QUIET_MS - (Date.now() - lastRefresh);
  if (wait <= 0) {
    if (pending) {
      clearTimeout(pending);
      pending = null;
      pendingRouter = null;
    }
    run(router);
    return;
  }
  pendingRouter = router;
  if (pending) return;
  pending = setTimeout(() => {
    const next = pendingRouter;
    if (next) run(next);
  }, wait);
}
