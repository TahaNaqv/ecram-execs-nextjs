import { interpolate } from "@/lib/i18n/interpolate";

export type RoutePointLabels = {
  /** First place in travelling order. */
  collection: string;
  /** Last place in travelling order. */
  destination: string;
  /** "Stop {number}" for a place between collection and destination. */
  stop: string;
};

/**
 * Collection, then Stop 1, Stop 2, … for the places between, then Destination.
 * A route of one place is the collection. Stop numbers start at 1 for the first intermediate place.
 */
export function routePointLabel(index: number, count: number, labels: RoutePointLabels): string {
  if (count <= 1 || index <= 0) return labels.collection;
  if (index >= count - 1) return labels.destination;
  return interpolate(labels.stop, { number: index });
}

/**
 * "Collection: …", "Stop 1: …", "Destination: …" in travelling order.
 * Pass the places with their slots kept, including blanks: the first slot is collection and the last is destination,
 * so a stop is not renamed when the drop-off is still empty. Blank places are left out.
 */
export function labelledRoute(places: readonly string[], labels: RoutePointLabels): string[] {
  const slots = places.map((place) => place.trim());
  const last = slots.length - 1;
  return slots.flatMap((place, index) => {
    if (!place) return [];
    const label = index === 0 ? labels.collection : index === last ? labels.destination : interpolate(labels.stop, { number: index });
    return [`${label}: ${place}`];
  });
}
