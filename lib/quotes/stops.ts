/**
 * Stops on the way (stopovers). Each has a place and the minutes the chauffeur waits there. They are stored as two
 * arrays of the same length: `destinations` (the places) and `destination_waits` (the minutes), so everything that
 * only needs the places keeps working. A request made before waiting times existed has no waits: read as none.
 */
export const MAX_STOPS = 5;

/** The waiting times a stop can have, in minutes. 0 is no waiting. */
export const STOP_WAITS = [0, 15, 30, 45, 60, 90, 120, 180] as const;

/** Anything that is not one of the offered times counts as no waiting, so a hand-made form cannot store odd values. */
export const asWait = (value: unknown): number => {
  const minutes = Number(value);
  return (STOP_WAITS as readonly number[]).includes(minutes) ? minutes : 0;
};

/** The stops of a submitted form, in order: each place with its wait. A stop with no place is dropped, and its wait with it. */
export function readStops(formData: FormData) {
  const places = formData.getAll("destinations");
  const waits = formData.getAll("destinationWaits");
  const stops = places
    .map((place, i) => ({ place: String(place).trim().slice(0, 200), wait: asWait(waits[i]) }))
    .filter((stop) => stop.place)
    .slice(0, MAX_STOPS);
  return { destinations: stops.map((s) => s.place), destinationWaits: stops.map((s) => s.wait) };
}

/** The stored arrays as one list. */
export const stopsWithWaits = (destinations: string[] | null, waits: number[] | null) =>
  (destinations ?? []).map((place, i) => ({ place, wait: asWait(waits?.[i]) }));
