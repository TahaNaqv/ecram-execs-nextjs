/**
 * Where a booking goes, as links Google's map understands: an embedded map for the booking page, and a link that opens the
 * same route in Google Maps (to hand to the chauffeur, or to look at on a phone). Addresses go in as typed; Google finds them.
 */
export type MapBooking = {
  collection?: string | null;
  destination?: string | null;
  destinations?: string[] | null;
};

export type RouteMapLinks = {
  /** The Maps Embed API address, or null when there is no key to embed with */
  embed: string | null;
  /** Opens the same route in Google Maps; needs no key */
  open: string;
};

/** The Maps Embed API takes up to 20 stops along the way; a booking never has more than a handful. */
const MAX_WAYPOINTS = 20;
/** The link that opens Google Maps takes fewer (9 on a computer, 3 on some phones) and breaks the route when given more. */
const MAX_OPEN_WAYPOINTS = 9;

/** The links for a booking's route, or null when it has nowhere to show (a bespoke request with no addresses). */
export function routeMapLinks(b: MapBooking, embedKey?: string | null): RouteMapLinks | null {
  const from = b.collection?.trim();
  const to = b.destination?.trim();
  if (!from) return null;
  const stops = (b.destinations ?? []).map((s) => s.trim()).filter(Boolean).slice(0, MAX_WAYPOINTS);

  // An hourly booking has no destination: the one place is shown
  if (!to) {
    return {
      embed: embedKey ? `https://www.google.com/maps/embed/v1/place?${new URLSearchParams({ key: embedKey, q: from, region: "nl" })}` : null,
      open: `https://www.google.com/maps/search/?${new URLSearchParams({ api: "1", query: from })}`,
    };
  }

  const waypoints = stops.join("|");
  const openWaypoints = stops.slice(0, MAX_OPEN_WAYPOINTS).join("|");
  return {
    embed: embedKey
      ? `https://www.google.com/maps/embed/v1/directions?${new URLSearchParams({
          key: embedKey,
          origin: from,
          destination: to,
          ...(waypoints ? { waypoints } : {}),
          mode: "driving",
          region: "nl",
        })}`
      : null,
    open: `https://www.google.com/maps/dir/?${new URLSearchParams({
      api: "1",
      origin: from,
      destination: to,
      ...(openWaypoints ? { waypoints: openWaypoints } : {}),
      travelmode: "driving",
    })}`,
  };
}
