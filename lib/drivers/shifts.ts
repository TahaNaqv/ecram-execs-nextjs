/**
 * Driver shift compliance from time actually on duty.
 * Waiting with a client is working time. Only a gap of at least 15 minutes between jobs counts as a break.
 * An open shift is treated as ended at 10 hours when that limit has passed.
 */

export const SHIFT_CAP_MS = 10 * 3_600_000;
export const BREAK_AFTER_MS = 5.5 * 3_600_000;
export const WARN_AFTER_MS = 4.5 * 3_600_000;
export const MIN_BREAK_BLOCK_MS = 15 * 60_000;
export const BREAK_TARGET_MS = 30 * 60_000;
export const LONG_BREAK_TARGET_MS = 45 * 60_000;

export type Span = { start: number; end: number };

export type Compliance = "green" | "yellow" | "red";

export function capShift(start: number, end: number | null, now: number): { end: number; autoClosed: boolean } {
  const cap = start + SHIFT_CAP_MS;
  if (end === null) {
    if (now >= cap) return { end: cap, autoClosed: true };
    return { end: now, autoClosed: false };
  }
  if (end > cap) return { end: cap, autoClosed: true };
  return { end, autoClosed: false };
}

/** Elapsed duty after the 10-hour cap. This is not the client's billed minimum. */
export function workedMs(start: number, end: number | null, now: number): number {
  const capped = capShift(start, end, now);
  return Math.max(0, capped.end - start);
}

export function mergeSpans(spans: Span[]): Span[] {
  const sorted = spans.filter((span) => span.end > span.start).sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: Span[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (!last || span.start > last.end) merged.push({ start: span.start, end: span.end });
    else last.end = Math.max(last.end, span.end);
  }
  return merged;
}

/**
 * Off-duty stretches between jobs inside the shift. Time before the first job and after the last
 * is not a break. Overlapping jobs, including waiting on the client, are one block of work.
 */
export function gapsBetweenJobs(jobs: Span[], shift: Span): Span[] {
  const work = mergeSpans(
    jobs
      .map((job) => ({ start: Math.max(job.start, shift.start), end: Math.min(job.end, shift.end) }))
      .filter((job) => job.end > job.start),
  );
  const gaps: Span[] = [];
  for (let i = 1; i < work.length; i++) {
    if (work[i].start > work[i - 1].end) gaps.push({ start: work[i - 1].end, end: work[i].start });
  }
  return gaps;
}

/** A gap counts only when the driver is off duty for 15 minutes without a break in between. */
export function validBreakBlocks(gaps: Span[]): Span[] {
  return gaps.filter((gap) => gap.end - gap.start >= MIN_BREAK_BLOCK_MS);
}

export function spanMs(spans: Span[]): number {
  return mergeSpans(spans).reduce((total, span) => total + (span.end - span.start), 0);
}

/** 30 minutes from just over 5.5 hours through 10 hours. 45 minutes once the duty runs past 10. */
export function requiredBreakMs(worked: number): number {
  if (worked > SHIFT_CAP_MS) return LONG_BREAK_TARGET_MS;
  if (worked > BREAK_AFTER_MS) return BREAK_TARGET_MS;
  return 0;
}

export function complianceOf(worked: number, breakMs: number): Compliance {
  const required = requiredBreakMs(worked);
  if (required === 0) return worked >= WARN_AFTER_MS && breakMs < MIN_BREAK_BLOCK_MS ? "yellow" : "green";
  if (breakMs >= required) return "green";
  if (breakMs > 0) return "yellow";
  return "red";
}

export type ShiftEvaluation = {
  workedMs: number;
  breakMs: number;
  /** Detected gaps and manual blocks that each last at least 15 minutes, after they are merged. */
  blocks: Span[];
  requiredMs: number;
  compliance: Compliance;
  autoClosed: boolean;
  shiftEnd: number;
};

export function evaluateShift(input: {
  start: number;
  end: number | null;
  now: number;
  /** Each job from its start through client waiting. Do not pass the car's turnaround buffer. */
  jobs: Span[];
  manualBreaks?: Span[];
}): ShiftEvaluation {
  const capped = capShift(input.start, input.end, input.now);
  const shift = { start: input.start, end: capped.end };
  const worked = Math.max(0, capped.end - input.start);
  const raw = Math.max(0, (input.end ?? input.now) - input.start);
  const dutyForTarget = raw > SHIFT_CAP_MS ? raw : worked;
  const detected = validBreakBlocks(gapsBetweenJobs(input.jobs, shift));
  const manual = validBreakBlocks(
    (input.manualBreaks ?? [])
      .map((block) => ({ start: Math.max(block.start, shift.start), end: Math.min(block.end, shift.end) }))
      .filter((block) => block.end > block.start),
  );
  const blocks = mergeSpans([...detected, ...manual]);
  const breaks = spanMs(blocks);
  return {
    workedMs: worked,
    breakMs: breaks,
    blocks,
    requiredMs: requiredBreakMs(dutyForTarget),
    compliance: complianceOf(dutyForTarget, breaks),
    autoClosed: capped.autoClosed,
    shiftEnd: capped.end,
  };
}
