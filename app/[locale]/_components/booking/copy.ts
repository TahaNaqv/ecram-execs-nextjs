import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { amsterdamWall } from "@/lib/time/amsterdam";

/** The booking flow's words, from the `booking` section of the dictionaries. */
export type BookingCopy = Dictionary["booking"];
/** The add-ons' names and notes, from the `addOns` section. */
export type AddOnsCopy = Dictionary["addOns"];

/** The validation messages the flow shows before anything is sent (the same ones the server uses, `forms.*`). */
export type TripMessages = Pick<
  Dictionary["forms"],
  "collectionRequired" | "destinationRequired" | "samePlace" | "consecutivePlace" | "vehiclePassengers" | "vehicleLuggage" | "vehicleBoth" | "pickupInvalid" | "pickupPast" | "pickupTooFar" | "flightInvalid" | "checkHighlighted" | "guestsRequired" | "nameRequired" | "emailInvalid" | "phoneNumberInvalid"
>;

/** The current wall-clock time in the Netherlands as "YYYY-MM-DDTHH:mm": pick-ups are Dutch times, whatever the visitor's zone. */
export function netherlandsNow() {
  return amsterdamWall();
}
