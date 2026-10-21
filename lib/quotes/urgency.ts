import { amsterdamNow } from "@/lib/quotes/validation";
import type { RequestStatus } from "@/lib/quotes/constants";

/** The statuses in which a booking can still need attention: everything but completed and cancelled. */
const OPEN: readonly RequestStatus[] = ["new", "contacted", "quoted", "confirmed"];

/**
 * A booking is urgent when it is still open and the pick-up is within the next 24 hours, or started in the last six (a
 * trip already underway is the most urgent of all). Pick-ups are Dutch wall-clock text, so they compare as strings with
 * the Amsterdam clock, as everywhere else. Reads the current time: call it per request, never inside a cached scope.
 */
export function isUrgent({ status, pickupAt }: { status: RequestStatus; pickupAt: string | null }): boolean {
  if (!OPEN.includes(status) || !pickupAt) return false;
  // The database returns "2026-11-12 08:30:00" and amsterdamNow gives "2026-11-12T08:30": same shape first, or a space
  // sorts before the "T" and every pick-up on the boundary day is judged against the wrong hour
  const when = pickupAt.slice(0, 16).replace(" ", "T");
  return when >= amsterdamNow(-6 * 60) && when <= amsterdamNow(24 * 60);
}
