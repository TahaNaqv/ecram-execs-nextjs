"use client";

import { useEffect, useRef } from "react";

/**
 * Next keeps a page mounted when the visitor leaves it, so the booking bar and the booking flows would still hold the trip
 * of a booking that has been sent when the visitor comes back to them. Each sent booking is counted for the browser session;
 * every form that holds a trip remembers the count it started at, and starts again when it is shown with a higher one
 * (QA round 3, bug 3). A count rather than a flag, so that every form sees every booking, not only the first to ask.
 */
const KEY = "ee-bookings-sent";

const read = () => {
  try {
    return Number(sessionStorage.getItem(KEY)) || 0;
  } catch {
    return 0; // storage blocked: the forms then keep what they hold, as they did before
  }
};
const write = (n: number) => {
  try {
    sessionStorage.setItem(KEY, String(Math.max(0, n)));
  } catch {
    // nothing to remember it with
  }
};

export const markBookingSent = () => write(read() + 1);
/** A send that came back with an error did not send anything, so the forms keep what they hold. (A send that never came back, a dropped connection, stays counted: the forms start empty, which is the safe side.) */
export const unmarkBookingSent = () => write(read() - 1);

/** Calls `onReset` when the component is shown again after a booking has been sent since it was shown last. */
export function useResetAfterBooking(onReset: () => void) {
  const seen = useRef<number | null>(null);
  const reset = useRef(onReset);
  useEffect(() => {
    reset.current = onReset;
  });
  useEffect(() => {
    // Runs when the component mounts and each time Next shows the page again after Back; also for a page the browser restores
    const check = () => {
      const now = read();
      if (seen.current === null) seen.current = now;
      else if (now !== seen.current) {
        const sent = now > seen.current;
        seen.current = now;
        if (sent) reset.current();
      }
    };
    check();
    const onShow = (event: PageTransitionEvent) => event.persisted && check();
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);
}
