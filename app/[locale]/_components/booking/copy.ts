import type { Dictionary } from "@/lib/i18n/get-dictionary";

/** The booking flow's words, from the `booking` section of the dictionaries. */
export type BookingCopy = Dictionary["booking"];

/** The validation messages the flow shows before anything is sent (the same ones the server uses, `forms.*`). */
export type TripMessages = Pick<
  Dictionary["forms"],
  "collectionRequired" | "destinationRequired" | "pickupInvalid" | "pickupPast" | "returnBeforePickup" | "checkHighlighted"
>;

/** The current wall-clock time in the Netherlands as "YYYY-MM-DDTHH:mm": pick-ups are Dutch times, whatever the visitor's zone. */
export function netherlandsNow() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Amsterdam",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date())
    .replace(" ", "T");
}
