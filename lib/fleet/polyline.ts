export type LatLng = { lat: number; lng: number };

/**
 * The points of a route as Google writes them: one text, each point stored as its difference from the one before
 * (https://developers.google.com/maps/documentation/utilities/polylinealgorithm). Text that stops half way is read as far as it goes.
 */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  const next = (): number | null => {
    let result = 0;
    let shift = 0;
    let byte: number;
    do {
      if (index >= encoded.length) return null;
      byte = encoded.charCodeAt(index++) - 63;
      result += (byte & 0x1f) * 2 ** shift;
      shift += 5;
    } while (byte >= 0x20);
    return result % 2 === 1 ? -Math.floor((result + 1) / 2) : result / 2;
  };
  while (index < encoded.length) {
    const dLat = next();
    const dLng = next();
    if (dLat === null || dLng === null) break;
    lat += dLat;
    lng += dLng;
    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}
