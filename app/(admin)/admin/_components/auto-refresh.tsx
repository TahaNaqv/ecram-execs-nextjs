"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { refreshOnce } from "./refresh-once";

/**
 * Asks the server for a fresh page while it stays open, so new bookings, enquiries and messages
 * show up without a manual reload. Hidden tabs wait until they are visible again.
 * The first paint is already fresh, so this does not refresh on mount: that second request was
 * aborting the Suspense stream still rendering the page.
 */
export function AutoRefresh({ seconds = 5 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState !== "visible") return;
      refreshOnce(router);
    };
    const timer = window.setInterval(refresh, seconds * 1000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [router, seconds]);
  return null;
}
