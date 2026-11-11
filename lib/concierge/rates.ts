import { FLEET } from "@/lib/fleet/vehicles";
import type { Locale } from "@/lib/i18n/config";
import { formatCents, hourlyRate, type DayKind } from "@/lib/pricing/rates";

const DAYS: DayKind[] = ["weekday", "saturday", "sunday"];

const dayWord = (day: DayKind, locale: Locale) =>
  locale === "nl"
    ? day === "weekday"
      ? "een weekdag"
      : day === "saturday"
        ? "zaterdag"
        : "zondag"
    : day === "weekday"
      ? "a weekday"
      : day === "saturday"
        ? "Saturday"
        : "Sunday";

/** A visitor asking what a car, a rate or a journey costs, in either language of the site. */
export const asksAboutPrice = (message: string) =>
  /\b(price|prices|rate|rates|cost|costs|how much|hourly|per hour|tariff|fare|prijs|prijzen|tarief|tarieven|kost|kosten|per uur)\b/i.test(message);

/** The public hourly rate card, one line per car, for the concierge to quote from. Amounts are the rate card's own. */
export function publicRateCard(locale: Locale): string {
  return FLEET.map((car) => {
    const parts = DAYS.flatMap((day) => {
      const rate = hourlyRate(car.key, "public", day);
      if (rate === null) return [];
      const per = locale === "nl" ? "per uur op" : "per hour on";
      return [`${formatCents(rate, locale)} ${per} ${dayWord(day, locale)}`];
    });
    const minimum = locale === "nl" ? "Minimaal 2 uur." : "Minimum 2 hours.";
    return `${car.name}: ${parts.join(", ")}. ${minimum}`;
  }).join("\n");
}

/**
 * A direct answer for "what does this car cost", from the public rate card. Null when the question is not about a
 * price, or names no car: a journey total has to come from the priced booking, not from this line.
 */
export function namedCarRateReply(message: string, locale: Locale): string | null {
  if (!asksAboutPrice(message)) return null;
  const text = message.toLowerCase();
  const car = FLEET.find((v) => text.includes(v.name.toLowerCase()) || text.includes(v.key.replaceAll("_", " ")));
  if (!car) return null;
  const euro = (day: DayKind) => {
    const rate = hourlyRate(car.key, "public", day);
    return rate === null ? "" : formatCents(rate, locale);
  };
  if (locale === "nl") {
    return `${car.name}: ${euro("weekday")} per uur op een weekdag, ${euro("saturday")} op zaterdag en ${euro("sunday")} op zondag. Minimaal 2 uur. Het totaal van een rit komt van dit tarief; 9% btw en de servicefee komen erbij.`;
  }
  return `${car.name}: ${euro("weekday")} per hour on a weekday, ${euro("saturday")} on Saturday and ${euro("sunday")} on Sunday. The minimum is 2 hours. A journey total uses this rate card; 9% BTW / VAT and the service fee are added.`;
}
