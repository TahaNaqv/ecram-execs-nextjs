"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function CorporateRefresh() {
  const router = useRouter();

  useEffect(() => {
    const handleRefresh = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.refresh();
        return;
      }
      router.refresh();
    };

    window.addEventListener("focus", () => router.refresh());
    window.addEventListener("pageshow", handleRefresh);

    return () => {
      window.removeEventListener("focus", () => router.refresh());
      window.removeEventListener("pageshow", handleRefresh);
    };
  }, [router]);

  return null;
}