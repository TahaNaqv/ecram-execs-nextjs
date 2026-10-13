import { z } from "zod";
import { SERVICES, VEHICLE_CLASSES } from "@/lib/quotes/constants";
import { LOCALES } from "@/lib/i18n/config";

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
};

export const quoteSchema = (t: QuoteMessages) =>
  z.object({
    collection: z.string().trim().min(1, t.collectionRequired).max(200, t.collectionTooLong),
    destination: z.string().trim().min(1, t.destinationRequired).max(200, t.destinationTooLong),
    pickupAt: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, t.pickupInvalid)
      // Allow a little slack for slow form fills; reject clearly past or far-future dates
      .refine((v) => v >= amsterdamNow(-60), t.pickupPast)
      .refine((v) => v <= amsterdamNow(60 * 24 * 730), t.pickupTooFar),
    service: z.enum(SERVICES, { error: t.serviceRequired }),
    passengers: z.coerce.number().int().min(1).max(50).optional(),
    name: z.string().trim().min(1, t.nameRequired).max(120, t.nameTooLong),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email(t.emailInvalid)),
    vehicleClass: z.enum(VEHICLE_CLASSES).optional(),
    // Collected as two fields; stored as one "+31 6 1234 5678" string (see the transform below).
    phoneCountry: z
      .string()
      .trim()
      .transform((v) => v.replace(/^\+/, ""))
      .pipe(z.string().regex(/^[0-9]{1,4}$/, t.phoneCountryInvalid)),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9 ()\-.]{5,20}$/, t.phoneNumberInvalid),
    notes: z.string().trim().max(2000, t.notesTooLong).optional(),
    // `next/root-params` is unavailable in Server Actions, so the form carries the locale.
    locale: z.enum(LOCALES).catch("en"),
  }).transform(({ phoneCountry, phone, ...rest }) => ({ ...rest, phone: `+${phoneCountry} ${phone}` }));

export type QuoteInput = z.infer<ReturnType<typeof quoteSchema>>;
/** Keys of the submitted form, which includes `phoneCountry` even though it is stored inside `phone`. */
export type QuoteField = keyof z.input<ReturnType<typeof quoteSchema>>;
