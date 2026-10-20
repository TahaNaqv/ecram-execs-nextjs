"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, type ComponentProps } from "react";

/**
 * The requests search box. Typing shows matching requests after a short pause, without pressing Enter (Enter and the
 * Search button still work, and are the way it works without JavaScript). The status tab in use is kept.
 */
export function LiveSearchInput({ status, ...props }: ComponentProps<"input"> & { status?: string }) {
  const router = useRouter();
  const timer = useRef<number | undefined>(undefined);
  // The pause is longer than a click on a status tab takes, so the timer must read the tab in use when it fires
  const current = useRef(status);
  useEffect(() => {
    current.current = status;
  }, [status]);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <input
      {...props}
      name="q"
      type="search"
      onChange={(e) => {
        const value = e.target.value.trim();
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          const sp = new URLSearchParams();
          if (current.current) sp.set("status", current.current);
          if (value) sp.set("q", value);
          router.replace(sp.size ? `/admin?${sp}` : "/admin", { scroll: false });
        }, 300);
      }}
    />
  );
}
