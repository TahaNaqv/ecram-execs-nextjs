import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Dictionary } from "@/lib/i18n/types";

/** Long enough that a passphrase of a few words fits, short enough that hashing one can't be used to burn the CPU. */
export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
/** The same typed password must hash the same way whatever keyboard or device it was typed on. */
export const normalizePassword = (value: string) => value.normalize("NFKC");

export const CONTACT_METHODS = ["email", "phone", "whatsapp"] as const;
export const TRIP_TIMES = ["morning", "afternoon", "evening"] as const;
export const DURATIONS = ["2_4", "2_8", "2_12", "2_24"] as const;

/**
 * The vehicles offered on the Corporate Partner form, exactly as the client listed them. Brand names are shown as-is
 * in every language. `fleetKey` links one to the website's fleet (lib/fleet/vehicles.ts) so the request carries the
 * same vehicle key as a quote does; the Mercedes-Benz EQS has no entry there yet, so it is recorded by name only.
 */
export const CORPORATE_VEHICLES = [
  { key: "mercedes_eqs", name: "Mercedes-Benz EQS", fleetKey: null },
  { key: "audi_etron_gt", name: "Audi e-tron GT", fleetKey: "audi" },
  { key: "mercedes_vle_300", name: "Mercedes-Benz VLE 300", fleetKey: "mercedes_vle_300" },
  { key: "cadillac_escalade_iq", name: "Cadillac Escalade IQ", fleetKey: "cadillac_escalade" },
  { key: "range_rover_ev", name: "Range Rover EV", fleetKey: "range_rover" },
  { key: "hongqi_e_hs9", name: "Hongqi E-HS9", fleetKey: "hongqi_e_hs9" },
] as const;
export const CORPORATE_VEHICLE_KEYS = CORPORATE_VEHICLES.map((v) => v.key) as [
  (typeof CORPORATE_VEHICLES)[number]["key"],
  ...(typeof CORPORATE_VEHICLES)[number]["key"][],
];

/** `dictionary.forms` and `dictionary.corporatePartner` satisfy these structurally. */
type FormMessages = Pick<
  Dictionary["forms"],
  "emailInvalid" | "nameRequired" | "nameTooLong" | "phoneInvalid" | "phoneCountryInvalid" | "phoneNumberInvalid" | "kvkInvalid" | "notesTooLong"
>;
type CorporateMessages = Pick<
  Dictionary["corporatePartner"],
  | "positionRequired"
  | "positionTooLong"
  | "codeInvalidFormat"
  | "chooseOption"
  | "companyRequired"
  | "companyTooLong"
  | "companyNumberInvalid"
  | "signatoryRequired"
  | "pointOfCallRequired"
  | "fieldTooLong"
  | "passwordTooShort"
  | "passwordTooLong"
  | "passwordMismatch"
>;

const email = (message: string) => z.string().trim().toLowerCase().max(200, message).pipe(z.email(message));

export const requestSchema = (f: FormMessages, c: CorporateMessages) =>
  z.object({
    email: email(f.emailInvalid),
    name: z.string().trim().min(1, f.nameRequired).max(120, f.nameTooLong),
    position: z.string().trim().min(1, c.positionRequired).max(120, c.positionTooLong),
    // A checkbox: present ("on") when ticked, absent otherwise
    marketingConsent: z.preprocess((v) => v === "on", z.boolean()),
    locale: z.enum(LOCALES).catch("en"),
  });

/** The reset form asks for the address only. */
export const resetRequestSchema = (f: FormMessages) => z.object({ email: email(f.emailInvalid), locale: z.enum(LOCALES).catch("en") });

/**
 * The last step of sign-up and of a reset: the emailed code and the new password, in one submission. The password is
 * checked here, before the server counts a guess at the code, so a too-short password never costs an attempt.
 */
export const completeSchema = (c: CorporateMessages) =>
  z
    .object({
      code: z.string().trim().regex(/^[0-9]{6}$/, c.codeInvalidFormat),
      password: z
        .string()
        .transform(normalizePassword)
        .pipe(
          z
            .string()
            .min(PASSWORD_MIN, interpolate(c.passwordTooShort, { min: PASSWORD_MIN }))
            .max(PASSWORD_MAX, interpolate(c.passwordTooLong, { max: PASSWORD_MAX })),
        ),
      confirmPassword: z.string().transform(normalizePassword),
      locale: z.enum(LOCALES).catch("en"),
    })
    .refine((v) => v.password === v.confirmPassword, { path: ["confirmPassword"], error: c.passwordMismatch });

export const onboardingSchema = (f: FormMessages, c: CorporateMessages) =>
  z.object({
    company: z.string().trim().min(1, c.companyRequired).max(200, c.companyTooLong),
    // A Dutch KvK number is 8 digits, but a foreign company has its own registration format, so this only
    // requires something that looks like a registration number.
    companyNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 .\-/]{2,24}$/, c.companyNumberInvalid),
    // The country code is its own field, as in the quote form; the two are stored together as "+31 6 1234 5678"
    phoneCountry: z
      .string()
      .trim()
      .transform((v) => v.replace(/^\+/, ""))
      .pipe(z.string().regex(/^[0-9]{1,4}$/, f.phoneCountryInvalid)),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9 ()\-.]{5,20}$/, f.phoneNumberInvalid),
    contactMethod: z.enum(CONTACT_METHODS, { error: c.chooseOption }),
    signatory: z.string().trim().min(1, c.signatoryRequired).max(120, c.fieldTooLong),
    pointOfCall: z.string().trim().min(1, c.pointOfCallRequired).max(120, c.fieldTooLong),
    vehicle: z.enum(CORPORATE_VEHICLE_KEYS, { error: c.chooseOption }),
    tripTime: z.enum(TRIP_TIMES, { error: c.chooseOption }),
    duration: z.enum(DURATIONS, { error: c.chooseOption }),
    notes: z.string().trim().max(2000, f.notesTooLong).optional(),
    locale: z.enum(LOCALES).catch("en"),
  }).transform(({ phoneCountry, phone, ...rest }) => ({ ...rest, phone: `+${phoneCountry} ${phone}` }));

export type RequestField = keyof z.input<ReturnType<typeof requestSchema>>;
export type OnboardingField = keyof z.input<ReturnType<typeof onboardingSchema>>;
export type CompleteField = keyof z.input<ReturnType<typeof completeSchema>>;
