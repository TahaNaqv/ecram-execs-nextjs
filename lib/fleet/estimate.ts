import "server-only";
import { cacheLife } from "next/cache";
import { routeEstimate, routesEnabled } from "@/lib/fleet/route";

export const estimateEnabled = routesEnabled;

export type DriveEstimate = { meters: number; seconds: number };

/**
 * How far and how long a trip drives, for the booking's review step: asked of Google once the visitor reaches the review,
 * never while they are still typing. Without traffic (the cheaper request: it is a guide for the visitor, the schedule asks
 * for its own), and kept for days per route, so going back and forth costs nothing. Throws when Google cannot say, so that
 * a failure is not kept along with the answers.
 */
export async function cachedDriveEstimate(from: string, to: string, stops: string[]): Promise<DriveEstimate> {
  "use cache";
  cacheLife("days");
  const found = await routeEstimate({ service: "business_travel", collection: from, destination: to, destinations: stops });
  if (!found) throw new Error("no estimate for this route");
  return found;
}
