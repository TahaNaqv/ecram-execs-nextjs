"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { refreshOnce } from "@/lib/nav/refresh-once";

/**
 * A partner's booking page while the booking manager reviews it (the client, 8 Nov 2026): asks the server for the page
 * again every few seconds, and as soon as the tab comes back into view, so the decision shows without a reload.
 */
export function ReviewRefresh({ seconds = 15 }: { seconds?: number }) {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") refreshOnce(router);
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
