import { z } from "zod";
import { HOURLY_DURATIONS, SERVICES } from "@/lib/quotes/constants";
import { VEHICLE_CHOICES, normalizeVehicleKey } from "@/lib/fleet/vehicles";
import { LOCALES } from "@/lib/i18n/config";
import { phoneLengthOk } from "@/lib/phone";

const AMS = "Europe/Amsterdam";

/** Current wall-clock time in the Netherlands as "YYYY-MM-DDTHH:mm". */
export function amsterdamNow(offsetMinutes = 0) {
  const d = new Date(Date.now() + offsetMinutes * 60_000);
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: AMS,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(d)
    .replace(" ", "T");
}

/**
 * The messages the schema needs. `dictionary.forms` satisfies this structurally.
 * Every message is user-facing, so the schema is built per request from the visitor's
 * dictionary rather than being a module constant.
 */
export type QuoteMessages = {
  collectionRequired: string;
  collectionTooLong: string;
  destinationRequired: string;
  destinationTooLong: string;
  nameRequired: string;
  nameTooLong: string;
  pickupInvalid: string;
  pickupPast: string;
  pickupTooFar: string;
  serviceRequired: string;
  emailInvalid: string;
  phoneCountryInvalid: string;
  phoneNumberInvalid: string;
  notesTooLong: string;
  durationRequired: string;
  flightInvalid: string;
  returnInvalid: string;
  returnBeforePickup: string;
  passengerNameTooLong: string;
  passengerPhoneInvalid: string;
};

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const PHONE_DIGITS = /^[0-9 ()\-.]{5,20}$/;
/** An optional field left empty arrives as "": treat it as not given. */
const blank = (v: unknown) => (typeof v === "string" && v.trim() === "" ? undefined : v);
const countryCode = (message: string) =>
  z
    .string()
    .trim()
    .transform((v) => v.replace(/^\+/, ""))
    .pipe(z.string().regex(/^[0-9]{1,4}$/, message));
// Only the id Google gives a place; the address text itself is kept in collection/destination
const placeId = z.preprocess(blank, z.string().max(300).regex(/^[A-Za-z0-9_-]+$/).optional());

export const quoteSchema = (t: QuoteMessages) =>
  z.object({
    collection: z.string().trim().min(1, t.collectionRequired).max(200, t.collectionTooLong),
    // Required unless the booking is hourly with a duration (checked below)
    destination: z.preprocess(blank, z.string().trim().max(200, t.destinationTooLong).optional()),
    pickupAt: z
      .string()
      .regex(WALL_CLOCK, t.pickupInvalid)
      // Allow a little slack for slow form fills; reject clearly past or far-future dates
      .refine((v) => v >= amsterdamNow(-60), t.pickupPast)
      .refine((v) => v <= amsterdamNow(60 * 24 * 730), t.pickupTooFar),
    returnAt: z.preprocess(
      blank,
      z.string().regex(WALL_CLOCK, t.returnInvalid).refine((v) => v <= amsterdamNow(60 * 24 * 730), t.pickupTooFar).optional(),
    ),
    service: z.enum(SERVICES, { error: t.serviceRequired }),
    durationHours: z.preprocess(
      blank,
      z.coerce
        .number()
        .int()
        .refine((h) => (HOURLY_DURATIONS as readonly number[]).includes(h), t.durationRequired)
        .optional(),
    ),
    passengers: z.coerce.number().int().min(1).max(50).optional(),
    luggage: z.preprocess(blank, z.coerce.number().int().min(0).max(20).optional()),
    // An airline flight ("KL 1002") or, for a private flight, the aircraft's registration ("PH-ABC")
    flightNumber: z.preprocess(
      blank,
      z
        .string()
        .trim()
        .toUpperCase()
        .transform((v) => v.replace(/\s+/g, " "))
        .pipe(z.string().regex(/^[A-Z0-9][A-Z0-9 -]{1,11}$/, t.flightInvalid))
        .optional(),
    ),
    pickupPlaceId: placeId,
    destinationPlaceId: placeId,
    // When the booker books for someone else; both stay empty when the booker travels
    passengerName: z.preprocess(blank, z.string().trim().max(120, t.passengerNameTooLong).optional()),
    passengerPhoneCountry: z.preprocess(blank, countryCode(t.phoneCountryInvalid).optional()),
    passengerPhone: z.preprocess(blank, z.string().trim().regex(PHONE_DIGITS, t.passengerPhoneInvalid).optional()),
    name: z.string().trim().min(1, t.nameRequired).max(120, t.nameTooLong),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email(t.emailInvalid)),
    vehicle: z
      .string()
      .optional()
      .transform((v) => (v ? (normalizeVehicleKey(v) ?? v) : undefined))
      .pipe(z.enum(VEHICLE_CHOICES).optional()),
    // When the booker books on behalf of a company or organization
    entity: z.preprocess(blank, z.string().trim().max(200).optional()),
    entityKvk: z.preprocess(blank, z.string().trim().max(30).optional()),
    // Collected as two fields; stored as one "+31 6 1234 5678" string (see the transform below).
    phoneCountry: countryCode(t.phoneCountryInvalid),
    phone: z.string().trim().regex(PHONE_DIGITS, t.phoneNumberInvalid),
    notes: z.string().trim().max(2000, t.notesTooLong).optional(),
    // `next/root-params` is unavailable in Server Actions, so the form carries the locale.
    locale: z.enum(LOCALES).catch("en"),
  }).superRefine((v, ctx) => {
    const issue = (path: string, message: string) => ctx.addIssue({ code: "custom", path: [path], message });
    // Too many or too few digits for the country (the forms stop typing at the limit; this is for anything that gets past them)
    if (!phoneLengthOk(v.phoneCountry, v.phone)) issue("phone", t.phoneNumberInvalid);
    if (v.passengerPhone && !phoneLengthOk(v.passengerPhoneCountry ?? v.phoneCountry, v.passengerPhone)) issue("passengerPhone", t.passengerPhoneInvalid);
    // Every journey has a destination, except an hourly booking, which may give its duration instead
    if (!v.destination && v.service !== "hourly") issue("destination", t.destinationRequired);
    if (!v.destination && v.service === "hourly" && !v.durationHours) issue("durationHours", t.durationRequired);
    if (v.returnAt && v.returnAt <= v.pickupAt) issue("returnAt", t.returnBeforePickup);
  }).transform(({ phoneCountry, phone, passengerPhoneCountry, passengerPhone, durationHours, ...rest }) => ({
    ...rest,
    phone: `+${phoneCountry} ${phone}`,
    passengerPhone: passengerPhone ? `+${passengerPhoneCountry ?? phoneCountry} ${passengerPhone}` : undefined,
    // A duration means something only for an hourly booking
    durationHours: rest.service === "hourly" ? durationHours : undefined,
  }));

export type QuoteInput = z.infer<ReturnType<typeof quoteSchema>>;
/** Keys of the submitted form, which includes `phoneCountry` even though it is stored inside `phone`. */
export type QuoteField = keyof z.input<ReturnType<typeof quoteSchema>>;
