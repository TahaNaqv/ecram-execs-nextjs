import { z } from "zod";
import { LOCALES } from "@/lib/i18n/config";
import { VEHICLE_KEYS } from "@/lib/fleet/vehicles";
import type { Dictionary } from "@/lib/i18n/types";

export const VOLUMES = ["1_5", "6_15", "16_40", "40_plus"] as const;
export const INVOICING = ["monthly", "per_trip", "purchase_order"] as const;

/** `dictionary.forms` and `dictionary.corporatePartner` satisfy these structurally. */
type FormMessages = Pick<Dictionary["forms"], "emailInvalid" | "nameRequired" | "nameTooLong" | "phoneInvalid" | "kvkInvalid" | "notesTooLong">;
type CorporateMessages = Pick<
  Dictionary["corporatePartner"],
  | "positionRequired"
  | "positionTooLong"
  | "codeInvalidFormat"
  | "chooseOption"
  | "companyRequired"
  | "companyTooLong"
  | "routesTooLong"
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

export const codeSchema = (c: CorporateMessages) => z.object({ code: z.string().trim().regex(/^[0-9]{6}$/, c.codeInvalidFormat) });

export const onboardingSchema = (f: FormMessages, c: CorporateMessages) =>
  z.object({
    company: z.string().trim().min(1, c.companyRequired).max(200, c.companyTooLong),
    kvk: z.string().trim().regex(/^[0-9]{8}$/, f.kvkInvalid).optional(),
    billingName: z.string().trim().min(1, f.nameRequired).max(120, f.nameTooLong),
    billingEmail: email(f.emailInvalid),
    phone: z.string().trim().regex(/^\+?[0-9 ()\-.]{7,24}$/, f.phoneInvalid),
    volume: z.enum(VOLUMES, { error: c.chooseOption }),
    routes: z.string().trim().max(1000, c.routesTooLong).optional(),
    vehicles: z.array(z.enum(VEHICLE_KEYS)).max(VEHICLE_KEYS.length),
    invoicing: z.enum(INVOICING, { error: c.chooseOption }),
    notes: z.string().trim().max(2000, f.notesTooLong).optional(),
    locale: z.enum(LOCALES).catch("en"),
  });

export type RequestField = keyof z.input<ReturnType<typeof requestSchema>>;
export type OnboardingField = keyof z.input<ReturnType<typeof onboardingSchema>>;
