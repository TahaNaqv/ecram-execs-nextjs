import { VEHICLE_CHOICES } from "@/lib/fleet/vehicles";
import { PLACE_KINDS } from "@/lib/places/types";
import { HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { MAX_STOPS, STOP_WAITS } from "@/lib/quotes/stops";

const text = (description: string) => ({ type: ["string", "null"], description });
const whole = (description: string) => ({ type: ["integer", "null"], description });

/**
 * The one tool the concierge model has: it changes the booking draft. It cannot send anything. Every field is optional (the
 * model sends only what changed) and null clears a field; what the model sends is cleaned and checked by lib/concierge/booking.ts.
 */
export const BOOKING_TOOL = {
  name: "update_booking",
  description:
    "Record or change details of the visitor's booking draft. Send only the fields the visitor has just given or changed, " +
    "exactly as they said them; send null to clear a field. Never guess a value the visitor has not given. " +
    "The answer lists what is still missing and what is wrong.",
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: {
      mode: { type: ["string", "null"], enum: ["oneway", "hourly", null], description: '"oneway" (from A to B, optionally with stops) or "hourly" (a chauffeur by the hour, "as directed")' },
      from: text("Pick-up place: an address, airport, hotel or station"),
      to: text("Destination (one way only)"),
      fromKind: { type: ["string", "null"], enum: [...PLACE_KINDS, null], description: '"airport" when the pick-up is an airport (Schiphol, AMS, Rotterdam The Hague, Eindhoven, Brussels, any other), "aviation" for a private-aviation terminal, else station, hotel or place' },
      toKind: { type: ["string", "null"], enum: [...PLACE_KINDS, null], description: "The same for the destination" },
      stops: {
        type: ["array", "null"],
        maxItems: MAX_STOPS,
        description: "Stops on the way for a one-way trip, in order, each with the minutes the chauffeur waits there. The whole list is replaced each time it is sent.",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["place"],
          properties: { place: { type: "string" }, wait: { type: "integer", enum: [...STOP_WAITS] } },
        },
      },
      hours: { type: ["integer", "null"], enum: [...HOURLY_DURATIONS, null], description: "Hours booked, for an hourly booking" },
      at: text('Pick-up date and time as "YYYY-MM-DDTHH:mm", 24-hour clock, Netherlands time'),
      ret: text('Return journey pick-up as "YYYY-MM-DDTHH:mm", Netherlands time; null for no return'),
      passengers: whole("Number of passengers including the visitor"),
      bags: whole("Number of large bags or suitcases"),
      flight: text('Flight number for an airport pick-up, for example "KL 1002"'),
      vehicle: { type: ["string", "null"], enum: [...VEHICLE_CHOICES, null], description: 'Car chosen, or "advise" when the visitor has no preference' },
      purpose: { type: ["string", "null"], enum: ["business", "private", null], description: "Only for a one-way trip that does not involve an airport" },
      name: text("The visitor's full name"),
      email: text("The visitor's email address"),
      phone: text("The visitor's mobile number, with the country code if they gave one"),
      passengerName: text("Name of the person travelling, only when the visitor books for someone else"),
      passengerPhone: text("Mobile number of the person travelling, only when the visitor books for someone else"),
      notes: text("A note for the chauffeur, for example a child seat or bulky luggage"),
    },
  },
} as const;
