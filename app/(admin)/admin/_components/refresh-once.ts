"use client";

/**
 * One router refresh at a time. A second call while a stream is still in flight aborts it, and React
 * then reports that the Suspense boundary could not finish and retries the same request.
 */
const MIN_GAP_MS = 2_000;
let lastRefresh = 0;

export function refreshOnce(router: { refresh: () => void }) {
  const now = Date.now();
  if (now - lastRefresh < MIN_GAP_MS) return;
  lastRefresh = now;
  router.refresh();
}
