/** Actual time on duty. Waiting with a client counts as work. A gap of 15 minutes or more between jobs is a break. */
export const BREAK_GAP_MINUTES = 15;
export const BREAK_AFTER_HOURS = 5.5;
export const BREAK_TARGET_MINUTES = 30;
export const LONG_SHIFT_HOURS = 10;
export const LONG_BREAK_TARGET_MINUTES = 45;

export type JobSpan = { start: number; end: number; waiting?: boolean };

export function breakMinutesFromGaps(jobs: JobSpan[]): number {
  const work = jobs.filter((job) => !job.waiting).sort((a, b) => a.start - b.start);
  let minutes = 0;
  for (let i = 1; i < work.length; i++) {
    const gap = work[i].start - work[i - 1].end;
    if (gap >= BREAK_GAP_MINUTES) minutes += gap;
  }
  return minutes;
}

/** What the shift still needs. Waiting time is not a break. Manual minutes are added to the gaps. */
export function breakStatus(input: { shiftMinutes: number; jobs: JobSpan[]; manualMinutes?: number }) {
  const taken = breakMinutesFromGaps(input.jobs) + Math.max(0, input.manualMinutes ?? 0);
  const target =
    input.shiftMinutes > LONG_SHIFT_HOURS * 60
      ? LONG_BREAK_TARGET_MINUTES
      : input.shiftMinutes > BREAK_AFTER_HOURS * 60
        ? BREAK_TARGET_MINUTES
        : 0;
  return { taken, target, short: Math.max(0, target - taken) };
}
