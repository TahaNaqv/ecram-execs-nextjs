"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

/**
 * The Corporate Partner pages show who is signed in, so a page the visitor comes back to must not show what was true when
 * they left it (Back after signing in or out, or the same page open in another tab). Next keeps a page mounted when you
 * leave it and shows the same tree again on the way back, so the server data is fetched again then: when Next shows the
 * page again (its effects run again) and when the browser restores it from its back-forward cache. Client state, such as a
 * half-filled form, is kept by a refresh. (Not on every return to the tab: that would re-render the page for nothing.)
 */
export function CorporateRefresh() {
  const router = useRouter();
  const wasHidden = useRef(false);

  useEffect(() => {
    // The cleanup below ran when the page was hidden, so this run is the page being shown again
    if (wasHidden.current) {
      wasHidden.current = false;
      router.refresh();
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) router.refresh();
    };
    window.addEventListener("pageshow", onPageShow);
    return () => {
      wasHidden.current = true;
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [router]);

  return null;
}
