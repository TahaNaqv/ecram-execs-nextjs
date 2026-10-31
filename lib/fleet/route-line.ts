import "server-only";
import { cacheLife } from "next/cache";
import { routeLine, type RoutedBooking } from "@/lib/fleet/route";

/**
 * The line a trip's route follows, for the day map. Google is asked once per trip and the answer is kept for days (the key is
 * the trip itself: its addresses, stops and pick-up), so opening the day again, or somebody else opening it, costs nothing.
 * When Google cannot say, this throws instead of returning, so that a failure is not remembered along with the successes.
 */
export async function cachedRouteLine(trip: RoutedBooking): Promise<string> {
  "use cache";
  cacheLife("days");
  const line = await routeLine(trip);
  if (!line) throw new Error("no route line for this trip");
  return line;
}
