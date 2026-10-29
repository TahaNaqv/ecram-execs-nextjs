import type { RequestStatus } from "@/lib/quotes/constants";

/**
 * When a confirmed booking has a car. Pick-ups are Dutch wall-clock text ("2026-11-12 08:30:00" from the database,
 * "2026-11-12T08:30" from a form), so all of this is plain minute arithmetic on that text: no time zone, and a trip that
 * runs over the clocks changing is out by an hour at most, which the buffer after every job absorbs.
 */

/** How long a trip is taken to last when the team has not said, per service. There is no routing service to ask. */
export const DEFAULT_TRIP_MINUTES = {
  airport_transfer: 90,
  business_travel: 90,
  hourly: 120,
  private_occasion: 120,
  bespoke: 120,
} as const;

/** The time after a job before the car can start another: the chauffeur's drive back, cleaning, charging. */
export const BUFFER_MINUTES = 30;

/** The most a trip can be set to last, in minutes (a long day of hourly work plus travel). */
export const MAX_TRIP_MINUTES = 16 * 60;

export type ScheduledBooking = {
  id: string;
  status: RequestStatus;
  service: string;
  pickupAt: string | null;
  returnAt: string | null;
  durationHours: number | null;
  blockMinutes: number | null;
};

/** One stretch of time a booking holds a car, in minutes since 1970 on the Dutch wall clock. `end` includes the buffer. */
export type Block = { id: string; leg: "outward" | "return"; start: number; end: number; tripEnd: number };

const WALL_CLOCK = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/;

/** Minutes since 1970 of a wall-clock text, or null when it is not one. */
export function wallMinutes(value: string | null | undefined): number | null {
  const m = value ? WALL_CLOCK.exec(value) : null;
  if (!m) return null;
  return Math.floor(Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]) / 60_000);
}

/** The wall-clock text "YYYY-MM-DDTHH:mm" of minutes since 1970 (the inverse of wallMinutes). */
export function wallText(minutes: number): string {
  return new Date(minutes * 60_000).toISOString().slice(0, 16);
}

/** How long the trip itself lasts: the team's own figure, else the hours of an hourly booking, else the service's default. */
export function tripMinutes(b: Pick<ScheduledBooking, "service" | "durationHours" | "blockMinutes">): number {
  if (b.blockMinutes && b.blockMinutes > 0) return b.blockMinutes;
  if (b.service === "hourly" && b.durationHours && b.durationHours > 0) return b.durationHours * 60;
  return DEFAULT_TRIP_MINUTES[b.service as keyof typeof DEFAULT_TRIP_MINUTES] ?? 120;
}

/** The stretches a booking holds its car: the outward journey, and the return journey when it has one. */
export function blocksOf(b: ScheduledBooking): Block[] {
  const length = tripMinutes(b);
  const blocks: Block[] = [];
  for (const [leg, at] of [["outward", b.pickupAt], ["return", b.returnAt]] as const) {
    const start = wallMinutes(at);
    if (start === null) continue;
    blocks.push({ id: b.id, leg, start, tripEnd: start + length, end: start + length + BUFFER_MINUTES });
  }
  return blocks;
}

/** Whether two stretches of time share any minute. Back to back (one ends where the next starts) does not overlap. */
export const overlaps = (a: { start: number; end: number }, b: { start: number; end: number }) => a.start < b.end && b.start < a.end;

/** The trip being asked about, as the forms know it: a pick-up, the hours of an hourly booking, a return pick-up. */
export type Window = { pickupAt: string; returnAt?: string | null; service?: string; durationHours?: number | null; blockMinutes?: number | null };

/** The stretches a trip would hold a car, for asking whether the car is free. */
export function windowBlocks(w: Window): Block[] {
  return blocksOf({
    id: "window",
    status: "confirmed",
    // Before the service is known (the form has not asked what the trip is for) the longest one-way length is assumed, so a car
    // is never offered that the team would then be unable to confirm
    service: w.service ?? (w.durationHours ? "hourly" : "private_occasion"),
    pickupAt: w.pickupAt,
    returnAt: w.returnAt ?? null,
    durationHours: w.durationHours ?? null,
    blockMinutes: w.blockMinutes ?? null,
  });
}

/** Spreads blocks that overlap in one column side by side: each gets a lane and the number of lanes its cluster needs. */
export function layOut<T extends { start: number; end: number }>(items: T[]): Array<T & { lane: number; lanes: number }> {
  const sorted = [...items].sort((a, b) => a.start - b.start || a.end - b.end);
  const out: Array<T & { lane: number; lanes: number }> = [];
  let cluster: Array<T & { lane: number; lanes: number }> = [];
  let clusterEnd = -Infinity;
  const flush = () => {
    const lanes = Math.max(1, ...cluster.map((c) => c.lane + 1));
    for (const c of cluster) c.lanes = lanes;
    out.push(...cluster);
    cluster = [];
  };
  for (const item of sorted) {
    if (cluster.length > 0 && item.start >= clusterEnd) flush();
    const taken = new Set(cluster.filter((c) => overlaps(c, item)).map((c) => c.lane));
    let lane = 0;
    while (taken.has(lane)) lane++;
    cluster.push({ ...item, lane, lanes: 1 });
    clusterEnd = Math.max(clusterEnd, item.end);
  }
  if (cluster.length > 0) flush();
  return out;
}
