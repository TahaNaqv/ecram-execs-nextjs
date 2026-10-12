import { z } from "zod";
import { CONTACT_PREFERENCES, VEHICLE_CLASSES } from "@/lib/quotes/constants";
import { LOCALES } from "@/lib/i18n/config";

/** The messages the schema needs; `dictionary.forms` satisfies this structurally. */
export type BespokeMessages = {
  nameRequired: string;
  nameTooLong: string;
  entityRequired: string;
  entityTooLong: string;
  emailInvalid: string;
  phoneInvalid: string;
  delegationInvalid: string;
  vehicleClassRequired: string;
  contactPreferenceRequired: string;
  itineraryRequired: string;
  itineraryTooLong: string;
};

export const bespokeSchema = (t: BespokeMessages) =>
  z.object({
    name: z.string().trim().min(1, t.nameRequired).max(120, t.nameTooLong),
    entity: z.string().trim().min(1, t.entityRequired).max(200, t.entityTooLong),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email(t.emailInvalid)),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()\-.]{7,24}$/, t.phoneInvalid),
    // A delegation can be far larger than a car's seats, so the ceiling is higher than the quote form's.
    passengers: z.coerce.number({ error: t.delegationInvalid }).int(t.delegationInvalid).min(1, t.delegationInvalid).max(500, t.delegationInvalid),
    vehicleClass: z.enum(VEHICLE_CLASSES, { error: t.vehicleClassRequired }),
    contactPreference: z.enum(CONTACT_PREFERENCES, { error: t.contactPreferenceRequired }),
    itinerary: z.string().trim().min(1, t.itineraryRequired).max(4000, t.itineraryTooLong),
    // `next/root-params` is unavailable in Server Actions, so the form carries the locale.
    locale: z.enum(LOCALES).catch("en"),
  });

export type BespokeInput = z.infer<ReturnType<typeof bespokeSchema>>;
export type BespokeField = keyof BespokeInput;
