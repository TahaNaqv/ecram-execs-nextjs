import { z } from "zod";
import { SERVICES } from "@/lib/quotes/constants";

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

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Please enter ${label}.`)
    .max(max, `${label[0].toUpperCase() + label.slice(1)} is too long.`);

export const quoteSchema = z.object({
  collection: text("a collection point", 200),
  destination: text("a destination", 200),
  pickupAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Please choose a date and time.")
    // Allow a little slack for slow form fills; reject clearly past or far-future dates
    .refine((v) => v >= amsterdamNow(-60), "Please choose a time in the future.")
    .refine((v) => v <= amsterdamNow(60 * 24 * 730), "Please choose a date within the next two years."),
  service: z.enum(SERVICES, { error: "Please choose a service." }),
  passengers: z.coerce.number().int().min(1).max(50).optional(),
  name: text("your name", 120),
  email: z.string().trim().toLowerCase().max(200).pipe(z.email("Please enter a valid email address.")),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9 ()\-.]{7,24}$/, "Please enter a valid phone number, including country code."),
  notes: z.string().trim().max(2000, "Notes are too long.").optional(),
});

export type QuoteInput = z.infer<typeof quoteSchema>;
export type QuoteField = keyof QuoteInput;
