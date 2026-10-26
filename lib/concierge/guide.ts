import { CODE_MINUTES } from "@/lib/corporate/otp";
import { PASSWORD_MIN } from "@/lib/corporate/validation";
import { FLEET } from "@/lib/fleet/vehicles";
import type { Dictionary } from "@/lib/i18n/types";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";

/** The cars by name, read from the fleet data so the concierge never lists a car the website does not show. */
export const fleetNames = () => FLEET.map((vehicle) => vehicle.name).join(", ");

const quote = (label: string) => `"${label}"`;

/**
 * How the website works, for the concierge to guide a visitor with. Every step, number and button name comes from the
 * application itself (the dictionary of the visitor's language and the same constants the forms use), so the briefing
 * changes when the website does. Steps and buttons that do not exist are not listed: the concierge is told to stay inside
 * this list.
 */
export function siteGuide(dict: Dictionary): string {
  const b = dict.booking;
  const p = dict.portal;
  const c = dict.corporatePartner;
  const hours = `${HOURLY_DURATIONS[0]} to ${HOURLY_DURATIONS[HOURLY_DURATIONS.length - 1]}`;
  const waits = STOP_WAITS.filter((minutes) => minutes > 0).join(", ");

  return `HOW THIS WEBSITE WORKS
Use this to guide visitors step by step. Only mention steps, buttons and pages listed here, and name buttons exactly as written in quotation marks.

Booking a ride (no account needed):
1. On the home page use the ${quote(dict.enquiry.heading)} bar; it continues on a booking page. There are three steps: ${quote(b.stepJourney)}, ${quote(b.stepCar)} and ${quote(b.stepDetails)}.
2. ${b.stepJourney}: choose ${quote(b.modeOneWay)} or ${quote(b.modeHourly)}. For one way enter where from and where to (an address, airport or hotel; suggestions appear while typing), the date and time (not in the past, up to two years ahead), and the guests and luggage (passengers including the visitor, and large suitcases). For by the hour there is no destination: the chauffeur is "as directed" for ${hours} hours. A return journey can be added to either. For one way trips up to ${MAX_STOPS} stops on the way can be added, each with a waiting time (${waits} minutes, or none). For airport pick-ups there is a field for the flight number, so the team can follow the flight. A party of eight or more travels in two cars, arranged together by the team.
3. ${b.stepCar}: optional. All of the cars are shown with photos and details, and how many each seats. ${quote(b.noPreference)} lets the team choose the best fit and name it in the quote.
4. ${b.stepDetails}: full name, email, mobile number with country code, whether the visitor is travelling or booking for someone else (then the passenger's name and mobile number), for one way trips that do not involve an airport whether the trip is business or private, and an optional note for the chauffeur (for example a child seat or bulky luggage). Then ${quote(b.submit)}.
5. What follows: the request is confirmed as received straight away, then a personal quote arrives, usually within the hour. The visitor accepts the quote by replying to the quote email, and the journey is confirmed.
Payment is not handled on this website: there is no online payment step. For payment or invoicing questions from visitors without an account, hand over to the team.

Email updates after a request: the visitor receives an email when the team picks the request up (they will be in touch shortly), when the quote is ready (with the amount), when the booking is confirmed or completed, and if it is cancelled.

Multi-city or multi-day programmes, events, roadshows and high-profile protocol: there is no separate form. The visitor describes the programme in the note of the ${quote(dict.enquiry.heading)} bar, or asks the team on WhatsApp; a member of the team follows up personally, never automatically.

Corporate partners (companies): the Corporate Partner page is reached with the ${quote(dict.whoWeServe.cta)} button (in the Who We Serve section and on the Corporate service card) or the ${quote(dict.hero.corporateLogin)} button at the top of the home page. A company can also simply contact the team to set up an account. On the page a new partner chooses ${quote(c.optionSignupCta)}; an existing partner logs in, and a partner who forgot the password gets a new six-digit code by email. Creating an account takes three short steps: details (company email, name, position) with ${quote(c.sendCode)}, the six-digit code emailed to verify the company email (valid ${CODE_MINUTES} minutes) with ${quote(c.verifyCta)}, then a password of at least ${PASSWORD_MIN} characters with ${quote(c.createAccountCta)}. Inside the account: ${quote(p.navBookings)} (tabs ${quote(p.tabAnswer)}, ${quote(p.tabOpen)}, ${quote(p.tabPast)}), ${quote(p.navNew)} (the same steps as the website, with the company and contact details already filled in from the account; the team replies with a quote), and ${quote(p.navIntro)} so the dispatch team can set up the corporate account and follow up personally. On a booking's page a partner can ${quote(p.acceptCta)} (this confirms the booking at once) or ${quote(p.declineCta)} (this cancels the booking), message the team, ask for a change or a cancellation, download invoices and ${quote(p.repeatCta)}.

Drive With Us (link ${quote(dict.footer.linkDriveWithUs)} in the footer): for independent chauffeurs with their own fully electric executive car. Three steps: apply with the licence plate (the car is checked instantly against the Dutch RDW register) and upload the documents (chauffeur card, KvK extract, VOG profile 70, proof of insurance for paid passenger transport; a Kiwa taxi transport licence is also needed); a short introduction where the team inspects the car and checks the original documents in person; then start driving. The page lists the exact criteria for the car.

WHAT YOU CANNOT DO
You cannot look up, change or cancel a booking, see a quote or the status of a request, check a car's availability on a date, give a price, or fill in or send a form for the visitor. Say so plainly when asked. Point to where the visitor can do it themselves (the emails they received; for corporate partners the booking page in their account) or hand over to the team on WhatsApp.`;
}
