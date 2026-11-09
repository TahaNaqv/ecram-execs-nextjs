import "server-only";
import { getFleetBase } from "@/lib/fleet/base-store";
import { routeHold as routeHoldFrom, type RoutedBooking } from "@/lib/fleet/route-core";

// The lookups live in route-core.ts so that scripts can use them too; the site reaches them through here
export * from "@/lib/fleet/route-core";

/** What confirming a booking needs from the route, with the drive home to the base the team set on the Fleet page. */
export async function routeHold(b: RoutedBooking & { blockMinutes?: number | null; driveBackMinutes?: number | null }) {
  return routeHoldFrom(b, b.driveBackMinutes == null ? await getFleetBase() : null);
}
