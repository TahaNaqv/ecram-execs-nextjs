"use server";

import { and, count, eq, gt, inArray } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import type { DriverApplication } from "@/lib/db/schema";
import { confirmApplication, notifyNewApplication } from "@/lib/email";
import { isUniqueViolation, makeReference, visitor } from "@/lib/request-meta";
import { amsterdamToday, DECLARATIONS, vehicleIssues } from "./criteria";
import { lookupVehicle } from "./rdw";
import { applicationSchema, type ApplicationField } from "./validation";

export type ApplicationFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<ApplicationField, string>>;
      /** Why the car doesn't meet the criteria, according to the RDW */
      vehicleIssues?: string[];
      values: Record<string, string>;
      attempt: number;
    }
  | { status: "success"; reference: string; name: string };

const FIELDS = ["name", "email", "phone", "kvk", "experienceYears", "plate", "notes", ...DECLARATIONS.map((d) => d.name)] as const;
const RATE_LIMIT = { max: 5, windowMinutes: 60 };

export async function submitApplication(prev: ApplicationFormState, formData: FormData): Promise<ApplicationFormState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const attempt = prev.status === "error" ? prev.attempt + 1 : 1;
  const fail = (message: string, fieldErrors: Partial<Record<ApplicationField, string>> = {}, issues?: string[]) =>
    ({ status: "error", message, fieldErrors, vehicleIssues: issues, values, attempt }) as const;

  // Honeypot: real visitors never see or fill this field
  if (String(formData.get("company_website") ?? "") !== "") {
    return { status: "success", reference: "AP-RECEIVED", name: values.name };
  }

  const parsed = applicationSchema.safeParse({ ...values, notes: values.notes || undefined });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<ApplicationField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as ApplicationField;
      fieldErrors[key] ??= issue.message;
    }
    return fail("Please check the highlighted details.", fieldErrors);
  }
  const input = parsed.data;

  const { ipHash, userAgent } = await visitor();
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000);
  const a = schema.driverApplications;
  const [{ recent }] = await db.select({ recent: count() }).from(a).where(and(eq(a.ipHash, ipHash), gt(a.createdAt, since)));
  if (recent >= RATE_LIMIT.max) {
    return fail("We have received several applications from you already — we will be in touch shortly.");
  }

  // One open application per car
  const [open] = await db
    .select({ reference: a.reference })
    .from(a)
    .where(and(eq(a.plate, input.plate), inArray(a.status, ["new", "reviewing"])))
    .limit(1);
  if (open) {
    return fail(`This car already has an application under review (${open.reference}). We will be in touch soon.`, {
      plate: "An application for this car is already being reviewed.",
    });
  }

  const vehicle = await lookupVehicle(input.plate);
  if (vehicle === null) {
    return fail("Please check the highlighted details.", {
      plate: "We couldn't find this plate in the RDW register. Please check it and try again.",
    });
  }
  if (vehicle !== "unavailable") {
    const issues = vehicleIssues(vehicle, amsterdamToday());
    if (issues.length) {
      return fail("Unfortunately this car doesn't meet our criteria.", { plate: "This car doesn't meet our criteria." }, issues);
    }
  }
  // If the RDW was unreachable the application is still saved, flagged for a manual check

  let saved: DriverApplication | undefined;
  for (let i = 0; i < 3 && !saved; i++) {
    try {
      [saved] = await db
        .insert(a)
        .values({
          reference: makeReference("AP"),
          name: input.name,
          email: input.email,
          phone: input.phone,
          kvk: input.kvk,
          experienceYears: input.experienceYears,
          notes: input.notes,
          plate: input.plate,
          ...(vehicle !== "unavailable" && {
            make: vehicle.make,
            model: vehicle.model,
            colour: vehicle.colour,
            seats: vehicle.seats,
            firstRegistered: vehicle.firstRegistered,
            apkExpires: vehicle.apkExpires,
            taxiRegistered: vehicle.taxiRegistered,
            openRecall: vehicle.openRecall,
            rdwCheckedAt: new Date(),
          }),
          ipHash,
          userAgent,
        })
        .returning();
    } catch (err) {
      // Retry only on a reference collision
      if (!isUniqueViolation(err) || i === 2) {
        console.error("[application] insert failed", err);
        return fail("Something went wrong on our side. Please try again, or contact us directly.");
      }
    }
  }
  const application = saved!;

  after(() => Promise.all([notifyNewApplication(application), confirmApplication(application)]));

  return { status: "success", reference: application.reference, name: application.name.split(" ")[0] };
}
