import { z } from "zod";
import { DECLARATIONS, DRIVER_CRITERIA, type Declaration, type DocumentName } from "./criteria";
import { LOCALES } from "@/lib/i18n/config";

/** The messages the schema needs. `dictionary.forms` satisfies this structurally. */
export type ApplicationMessages = {
  nameRequired: string;
  nameTooLong: string;
  emailInvalid: string;
  phoneInvalid: string;
  kvkInvalid: string;
  experienceRequired: string;
  experienceWhole: string;
  experienceMin: string;
  experienceMax: string;
  plateInvalid: string;
  notesTooLong: string;
  declarationRequired: string;
};

const fill = (template: string, values: Record<string, string | number>) =>
  template.replace(/\{(\w+)\}/g, (token, key: string) => (key in values ? String(values[key]) : token));

export const applicationSchema = (t: ApplicationMessages) => {
  const confirmed = z.literal("on", { error: t.declarationRequired });
  return z.object({
    name: z.string().trim().min(1, t.nameRequired).max(120, t.nameTooLong),
    email: z.string().trim().toLowerCase().max(200).pipe(z.email(t.emailInvalid)),
    phone: z
      .string()
      .trim()
      .regex(/^\+?[0-9 ()\-.]{7,24}$/, t.phoneInvalid),
    kvk: z
      .string()
      .transform((v) => v.replace(/\s/g, ""))
      .pipe(z.string().regex(/^\d{8}$/, t.kvkInvalid)),
    experienceYears: z.coerce
      .number({ error: t.experienceRequired })
      .int(t.experienceWhole)
      .min(DRIVER_CRITERIA.minExperienceYears, fill(t.experienceMin, { years: DRIVER_CRITERIA.minExperienceYears }))
      .max(60, t.experienceMax),
    // Dutch plates are 6 letters/digits, written with or without dashes
    plate: z
      .string()
      .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
      .pipe(z.string().regex(/^[A-Z0-9]{6}$/, t.plateInvalid)),
    notes: z.string().trim().max(2000, t.notesTooLong).optional(),
    // `next/root-params` is unavailable in Server Actions, so the form carries the locale.
    locale: z.enum(LOCALES).catch("en"),
    ...(Object.fromEntries(DECLARATIONS.map((d) => [d, confirmed])) as Record<Declaration, typeof confirmed>),
  });
};

export type ApplicationInput = z.infer<ReturnType<typeof applicationSchema>>;
export type ApplicationField = keyof ApplicationInput;
/** Everything the form can flag an error on */
export type FormField = ApplicationField | DocumentName;
