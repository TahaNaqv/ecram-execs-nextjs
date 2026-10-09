import { z } from "zod";
import { DECLARATIONS, DRIVER_CRITERIA, type DocumentName } from "./criteria";

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Please enter ${label}.`)
    .max(max, `${label[0].toUpperCase() + label.slice(1)} is too long.`);

const confirmed = z.literal("on", { error: "Please confirm this to continue." });

export const applicationSchema = z.object({
  name: text("your name", 120),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Please enter a valid email address.")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()\-.]{7,24}$/, "Please enter a valid phone number, including country code."),
  kvk: z
    .string()
    .transform((v) => v.replace(/\s/g, ""))
    .pipe(z.string().regex(/^\d{8}$/, "Please enter your 8-digit KvK number.")),
  experienceYears: z.coerce
    .number({ error: "Please enter your years of experience." })
    .int("Please enter whole years.")
    .min(DRIVER_CRITERIA.minExperienceYears, `We ask for at least ${DRIVER_CRITERIA.minExperienceYears} years of professional driving experience.`)
    .max(60, "Please check your years of experience."),
  // Dutch plates are 6 letters/digits, written with or without dashes
  plate: z
    .string()
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, ""))
    .pipe(z.string().regex(/^[A-Z0-9]{6}$/, "Please enter a Dutch licence plate, e.g. T-123-AB.")),
  notes: z.string().trim().max(2000, "Notes are too long.").optional(),
  ...(Object.fromEntries(DECLARATIONS.map((d) => [d.name, confirmed])) as Record<(typeof DECLARATIONS)[number]["name"], typeof confirmed>),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;
export type ApplicationField = keyof ApplicationInput;
/** Everything the form can flag an error on */
export type FormField = ApplicationField | DocumentName;
