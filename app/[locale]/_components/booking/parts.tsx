/** Small pieces both the booking flow and its review step draw. */

export const Check = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="M5 12l5 5L19 7" />
  </svg>
);

export const SeatIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c1-4 4-6 8-6s7 2 8 6" />
  </svg>
);

/** "Thu 5 Nov, 12:20" from a wall-clock "YYYY-MM-DDTHH:mm" in the Netherlands. */
export const pretty = (wallClock: string, locale: string) => {
  const [d, time] = wallClock.split("T");
  const [y, m, day] = d.split("-").map(Number);
  return `${new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, day)))}, ${time}`;
};
