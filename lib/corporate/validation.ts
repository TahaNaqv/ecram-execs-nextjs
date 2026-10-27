import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";
import { interpolate } from "@/lib/i18n/interpolate";
import type { Dictionary } from "@/lib/i18n/types";
import { phoneLengthOk } from "@/lib/phone";

export const PASSWORD_MIN = 12;
export const PASSWORD_MAX = 128;
export const normalizePassword = (value: string) => value.normalize("NFKC");

export const CONTACT_METHODS = ["email", "phone", "whatsapp"] as const;
export const TRIP_TIMES = ["morning", "afternoon", "evening"] as const;
export const DURATIONS = ["2_4", "2_8", "2_12", "2_24"] as const;

export const CORPORATE_VEHICLES = [
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
    companyName: z.string().trim().min(1, c.companyRequired).max(200, c.companyTooLong),
    kvkNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 .\-/]{2,24}$/, c.companyNumberInvalid),
    phone: z.string().trim().regex(/^[0-9 ()\-.+]{5,25}$/, f.phoneNumberInvalid),
    marketingConsent: z.preprocess((v) => v === "on", z.boolean()),
    locale: z.enum(LOCALES).catch("en"),
  });

export const resetRequestSchema = (f: FormMessages) => z.object({ email: email(f.emailInvalid), locale: z.enum(LOCALES).catch("en") });

export const codeSchema = (c: CorporateMessages) =>
  z.object({
    code: z.string().trim().regex(/^[0-9]{6}$/, c.codeInvalidFormat),
    locale: z.enum(LOCALES).catch("en"),
  });

export const completeSchema = (c: CorporateMessages) =>
  z
    .object({
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
    companyNumber: z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9 .\-/]{2,24}$/, c.companyNumberInvalid),
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
  }).superRefine(({ phoneCountry, phone }, ctx) => {
    if (!phoneLengthOk(phoneCountry, phone)) ctx.addIssue({ code: "custom", path: ["phone"], message: f.phoneNumberInvalid });
  }).transform(({ phoneCountry, phone, ...rest }) => ({ ...rest, phone: `+${phoneCountry} ${phone}` }));

export type RequestField = keyof z.input<ReturnType<typeof requestSchema>>;
export type OnboardingField = keyof z.input<ReturnType<typeof onboardingSchema>>;
export type CompleteField = keyof z.input<ReturnType<typeof completeSchema>>;
export type CodeField = keyof z.input<ReturnType<typeof codeSchema>>;