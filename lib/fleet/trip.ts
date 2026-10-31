import { MAX_TRIP_MINUTES, wallMinutes } from "@/lib/fleet/schedule";

/**
 * How long a car is held for a trip once Google has said how long the drive takes. The route is the drive only: the
 * chauffeur also meets the passenger, loads the luggage and finds a place to stop, so each service adds an allowance.
 */

/** Minutes added to the drive: an airport pick-up means waiting at arrivals; everything else is meeting and loading. */
export const ALLOWANCE_MINUTES = { airport_transfer: 30, business_travel: 10, private_occasion: 10 } as const;

/** The shortest a trip is held for, whatever the route says (a drive across the road still takes a booking's worth of time). */
export const MIN_TRIP_MINUTES = 20;

/** Services whose length comes from a route: the others have their hours, or no route to ask about. */
export const ROUTED_SERVICES: ReadonlySet<string> = new Set(Object.keys(ALLOWANCE_MINUTES));

/** Minutes the car is held: the drive, the service's allowance and the chauffeur's waits at the stops, to the next 5 minutes. */
export function blockMinutesFor(opts: { service: string; driveSeconds: number; waitMinutes?: number }): number | null {
  const allowance = ALLOWANCE_MINUTES[opts.service as keyof typeof ALLOWANCE_MINUTES];
  if (allowance === undefined || !Number.isFinite(opts.driveSeconds) || opts.driveSeconds <= 0) return null;
  const minutes = Math.ceil((opts.driveSeconds / 60 + allowance + (opts.waitMinutes ?? 0)) / 5) * 5;
  return Math.min(MAX_TRIP_MINUTES, Math.max(MIN_TRIP_MINUTES, minutes));
}

/** Google's duration text ("1234s", "1234.5s") in seconds, or null when it is anything else. */
export function parseDuration(text: unknown): number | null {
  const m = typeof text === "string" ? /^(\d+(?:\.\d+)?)s$/.exec(text) : null;
  return m ? Number(m[1]) : null;
}

const amsterdam = new Intl.DateTimeFormat("en-US", {
  timeZone: "Europe/Amsterdam",
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

/** The Dutch clock's offset from UTC at an instant, in milliseconds (3600000 in winter, 7200000 in summer). */
function offsetAt(instant: number): number {
  const p = Object.fromEntries(amsterdam.formatToParts(new Date(instant)).map((x) => [x.type, Number(x.value)]));
  return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute) - Math.floor(instant / 60_000) * 60_000;
}

/**
 * The moment a Dutch wall-clock pick-up ("2026-11-12 08:30:00" or "2026-11-12T08:30") happens, for Google, which wants a
 * real instant. The offset is found from the guess and corrected once, which settles both sides of a clock change.
 */
export function amsterdamInstant(wall: string | null | undefined): Date | null {
  const minutes = wallMinutes(wall);
  if (minutes === null) return null;
  const asUtc = minutes * 60_000;
  return new Date(asUtc - offsetAt(asUtc - offsetAt(asUtc)));
}
