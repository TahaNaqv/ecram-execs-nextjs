/**
 * An introducer's commission steps down with their tenure, counted from the start date on their profile (the client,
 * 27 Nov 2026): 2.5% in year 1, 2.0% in year 2, 1.5% in year 3, 1.0% in year 4, and 0.5% from year 5 on. A new tenure year
 * starts on each anniversary of the start date; a payment takes the rate of the day it was received (Amsterdam date).
 * Rates are kept in basis points (250 = 2.5%) so the halves are exact. Pure: shared by the board and the dialog.
 */

export const COMMISSION_SCHEDULE_BP = [250, 200, 150, 100, 50] as const;

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

/** The same calendar day `years` later; 29 February becomes 28 February in a year without it. */
export function anniversary(startIso: string, years: number): string {
  const [, y, m, d] = startIso.match(ISO)!;
  const year = Number(y) + years;
  const last = new Date(Date.UTC(year, Number(m), 0)).getUTCDate();
  return `${year}-${m}-${String(Math.min(Number(d), last)).padStart(2, "0")}`;
}

/** 1 in the first year from the start date, 2 from the first anniversary, and so on; 0 before the start date. */
export function tenureYear(startIso: string, onIso: string): number {
  if (!ISO.test(startIso) || !ISO.test(onIso) || onIso < startIso) return 0;
  let year = Number(onIso.slice(0, 4)) - Number(startIso.slice(0, 4));
  if (anniversary(startIso, year) > onIso) year -= 1;
  return year + 1;
}

/** The rate on a day, in basis points: nothing before the start date, 0.5% from year 5 on. */
export function commissionBasisPoints(startIso: string, onIso: string): number {
  const year = tenureYear(startIso, onIso);
  if (year === 0) return 0;
  return COMMISSION_SCHEDULE_BP[Math.min(year, COMMISSION_SCHEDULE_BP.length) - 1];
}

/** When the rate next changes (the next anniversary up to year 5), or null once it is locked at 0.5%. */
export function nextRateChange(startIso: string, onIso: string): { on: string; basisPoints: number } | null {
  const year = tenureYear(startIso, onIso);
  if (year >= COMMISSION_SCHEDULE_BP.length) return null;
  if (year === 0) return { on: startIso, basisPoints: COMMISSION_SCHEDULE_BP[0] };
  return { on: anniversary(startIso, year), basisPoints: COMMISSION_SCHEDULE_BP[year] };
}

/** "2.5%", "2%", "0.5%". */
export const formatRate = (basisPoints: number) => `${(basisPoints / 100).toLocaleString("en-GB", { maximumFractionDigits: 2 })}%`;
