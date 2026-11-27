/** Europe/Amsterdam wall-clock conversions. Assignments and shifts are stored as absolute instants. */

const ZONE = "Europe/Amsterdam";

const partsOf = (instant: Date) => {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ZONE,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  const hour = pick("hour") === "24" ? "00" : pick("hour");
  return { year: pick("year"), month: pick("month"), day: pick("day"), hour, minute: pick("minute"), second: pick("second") };
};

/** Offset of Amsterdam at this instant, in milliseconds (wall clock minus UTC). */
export function amsterdamOffsetMs(instant: Date): number {
  const p = partsOf(instant);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute), Number(p.second));
  return asUtc - instant.getTime();
}

/** Today in the Netherlands as YYYY-MM-DD. */
export function amsterdamToday(now = new Date()): string {
  const p = partsOf(now);
  return `${p.year}-${p.month}-${p.day}`;
}

/** A real calendar day plus HH:mm, read as Amsterdam local time. */
export function amsterdamWallToUtc(date: string, time: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) return null;
  const wallAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const first = new Date(wallAsUtc - amsterdamOffsetMs(new Date(wallAsUtc)));
  return new Date(wallAsUtc - amsterdamOffsetMs(first));
}

export function utcToAmsterdamParts(instant: Date): { date: string; time: string } {
  const p = partsOf(instant);
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * The minimum-notice rule applies only when the pickup calendar day is today in Amsterdam.
 * A later day is never "too soon", whatever the clock time is. Today is compared as a real instant against now plus the notice.
 */
export function pickupNeedsMoreNotice(pickupAt: string | null | undefined, now: Date, hours: number): boolean {
  if (!pickupAt || hours <= 0) return false;
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(pickupAt.trim());
  if (!match) return false;
  const date = match[1];
  const time = match[2];
  if (date !== amsterdamToday(now)) return false;
  const pickup = amsterdamWallToUtc(date, time);
  if (!pickup) return false;
  return pickup.getTime() < now.getTime() + hours * 3_600_000;
}

/**
 * A pick-up as stored. A value with a zone is an absolute instant. A bare wall clock
 * ("2026-11-25 08:30:00" or "2026-11-25T08:30") is Amsterdam local time.
 */
export function parseInstant(value: string | Date | null | undefined): Date | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (!value) return null;
  if (/[zZ]|[+-]\d{2}:?\d{2}$/.test(value)) {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  const match = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})/.exec(value);
  if (!match) return null;
  return amsterdamWallToUtc(match[1], match[2]);
}
