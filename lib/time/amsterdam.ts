import { wallMinutes } from "@/lib/fleet/schedule";

const AMS = "Europe/Amsterdam";

/**
 * A pick-up a few minutes behind the Dutch clock is still accepted: the bar fills in "now", and sending the form takes
 * a moment. Anything older is a past booking. There is no extra lead time on top of now.
 */
export const PICKUP_GRACE_MINUTES = 5;
/** The same horizon the quote schema allows: two years of wall-clock minutes. */
export const PICKUP_HORIZON_MINUTES = 60 * 24 * 730;

export type AmsterdamParts = { y: number; m: number; d: number; h: number; min: number };

const read = (date: Date) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone: AMS,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).formatToParts(date);

/**
 * The Netherlands wall clock at `date`. Built from parts, not from a formatted string, so a space, a 12-hour clock, or
 * an engine that writes midnight as "24" cannot shift the comparison into the visitor's own time zone.
 * Hour 24 is midnight at the start of the next calendar day (the date part has not rolled yet).
 */
export function amsterdamParts(date = new Date()): AmsterdamParts {
  const part = (type: string) => Number(read(date).find((p) => p.type === type)?.value);
  let y = part("year");
  let m = part("month");
  let d = part("day");
  let h = part("hour");
  const min = part("minute");
  if (h >= 24) {
    h -= 24;
    const rolled = new Date(Date.UTC(y, m - 1, d + 1));
    y = rolled.getUTCFullYear();
    m = rolled.getUTCMonth() + 1;
    d = rolled.getUTCDate();
  }
  return { y, m, d, h, min };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DDTHH:mm" in the Netherlands. */
export function amsterdamWall(date = new Date()): string {
  const p = amsterdamParts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}T${pad(p.h)}:${pad(p.min)}`;
}

/** The Dutch wall clock of a real instant `offsetMinutes` from `date` (negative is earlier). */
export function amsterdamWallOffset(offsetMinutes: number, date = new Date()): string {
  return amsterdamWall(new Date(date.getTime() + offsetMinutes * 60_000));
}

/**
 * True when `value` is a Dutch wall-clock time more than the grace before `nowWallClock`.
 * Both sides are minute counts of the wall clock, never `new Date(text)`, which would read the text in the browser's zone.
 */
export function isPastWall(value: string, nowWallClock: string, graceMinutes = PICKUP_GRACE_MINUTES): boolean {
  const at = wallMinutes(value);
  const now = wallMinutes(nowWallClock);
  if (at === null || now === null) return false;
  return at < now - graceMinutes;
}

/** True when `value` is further ahead than the booking horizon, on the same wall-clock scale. */
export function isBeyondHorizon(value: string, nowWallClock: string): boolean {
  const at = wallMinutes(value);
  const now = wallMinutes(nowWallClock);
  if (at === null || now === null) return false;
  return at > now + PICKUP_HORIZON_MINUTES;
}
