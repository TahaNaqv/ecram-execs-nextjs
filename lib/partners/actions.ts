"use server";

import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { and, count, eq, gt, inArray } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import type { DriverApplication } from "@/lib/db/schema";
import { confirmApplication, notifyNewApplication } from "@/lib/email";
import { isUniqueViolation, makeReference, visitor } from "@/lib/request-meta";
import { listFiles, removeFiles, signedUploadUrl, storageConfigured } from "@/lib/storage";
import {
  amsterdamToday,
  DECLARATIONS,
  DOCUMENT_TYPES,
  DOCUMENTS,
  MAX_DOCUMENT_BYTES,
  vehicleIssues,
  type ApplicationDocument,
  type DocumentName,
  type RdwVehicle,
} from "./criteria";
import { lookupVehicle } from "./rdw";
import { applicationSchema, type ApplicationInput, type FormField } from "./validation";

// Applying takes three steps, driven by the form: checkApplication validates the details and the
// car and hands out signed upload URLs; the browser uploads the documents straight to storage;
// submitApplication saves the application. A signed ticket carries the RDW result between the two
// actions so the (slow) register is only queried once.

export type ApplicationFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<FormField, string>>;
      /** Why the car doesn't meet the criteria, according to the RDW */
      vehicleIssues?: string[];
    }
  | { status: "success"; reference: string; name: string };

export type CheckResult =
  | Exclude<ApplicationFormState, { status: "idle" }>
  | { status: "ready"; ticket: string; uploads: { name: DocumentName; url: string }[] };

const FIELDS = ["name", "email", "phone", "kvk", "experienceYears", "plate", "notes", ...DECLARATIONS.map((d) => d.name)] as const;
const RATE_LIMIT = { max: 5, windowMinutes: 60 };
const TICKET_TTL_MS = 60 * 60_000;

const fail = (message: string, fieldErrors: Partial<Record<FormField, string>> = {}, issues?: string[]) =>
  ({ status: "error", message, fieldErrors, vehicleIssues: issues }) as const;

type Ticket = { folder: string; plate: string; vehicle: RdwVehicle | "unavailable"; files: Partial<Record<DocumentName, string>>; expires: number };

// Any server-side secret will do; the random fallback only works on a single instance (local development)
const ticketKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.IP_HASH_SALT || randomBytes(32).toString("hex");
const mac = (body: string) => createHmac("sha256", `application-ticket:${ticketKey}`).update(body).digest("base64url");

function signTicket(t: Ticket) {
  const body = Buffer.from(JSON.stringify(t)).toString("base64url");
  return `${body}.${mac(body)}`;
}

function readTicket(token: string): Ticket | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = Buffer.from(mac(body));
  if (expected.length !== sig.length || !timingSafeEqual(expected, Buffer.from(sig))) return null;
  const t = JSON.parse(Buffer.from(body, "base64url").toString()) as Ticket;
  return t.expires > Date.now() ? t : null;
}

/** Validates the form and applies the per-visitor and per-car limits. */
async function validate(formData: FormData) {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const parsed = applicationSchema.safeParse({ ...values, notes: values.notes || undefined });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<FormField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as FormField;
      fieldErrors[key] ??= issue.message;
    }
    return { ok: false as const, error: fail("Please check the highlighted details.", fieldErrors) };
  }
  const input = parsed.data;

  const { ipHash, userAgent } = await visitor();
  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000);
  const a = schema.driverApplications;
  const [{ recent }] = await db.select({ recent: count() }).from(a).where(and(eq(a.ipHash, ipHash), gt(a.createdAt, since)));
  if (recent >= RATE_LIMIT.max) {
    return { ok: false as const, error: fail("We have received several applications from you already — we will be in touch shortly.") };
  }

  // One open application per car
  const [open] = await db
    .select({ reference: a.reference })
    .from(a)
    .where(and(eq(a.plate, input.plate), inArray(a.status, ["new", "reviewing"])))
    .limit(1);
  if (open) {
    return {
      ok: false as const,
      error: fail(`This car already has an application under review (${open.reference}). We will be in touch soon.`, {
        plate: "An application for this car is already being reviewed.",
      }),
    };
  }
  return { ok: true as const, input, ipHash, userAgent };
}

/** Step 1: checks the details and the car, and returns where to upload the documents. */
export async function checkApplication(formData: FormData): Promise<CheckResult> {
  // Honeypot: real visitors never see or fill this field
  if (String(formData.get("company_website") ?? "") !== "") {
    return { status: "success", reference: "AP-RECEIVED", name: String(formData.get("name") ?? "") };
  }

  // The browser sends each document's type and size; Supabase enforces the same limits on upload
  const withDocuments = storageConfigured();
  const files: Partial<Record<DocumentName, string>> = {};
  const documentErrors: Partial<Record<FormField, string>> = {};
  if (withDocuments) {
    for (const d of DOCUMENTS) {
      const ext = DOCUMENT_TYPES[String(formData.get(`${d.name}Type`) ?? "")];
      const size = Number(formData.get(`${d.name}Size`));
      if (!size) documentErrors[d.name] = `Please add your ${d.label}.`;
      else if (!ext) documentErrors[d.name] = "Please upload a PDF, JPG or PNG.";
      else if (size > MAX_DOCUMENT_BYTES) documentErrors[d.name] = "This file is larger than 5 MB.";
      else files[d.name] = `${d.name}.${ext}`;
    }
  }

  const checked = await validate(formData);
  if (!checked.ok) {
    return { ...checked.error, fieldErrors: { ...checked.error.fieldErrors, ...documentErrors } };
  }
  if (Object.keys(documentErrors).length) return fail("Please check the highlighted details.", documentErrors);
  const { input } = checked;

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

  const folder = randomUUID();
  let uploads: { name: DocumentName; url: string }[] = [];
  if (withDocuments) {
    try {
      uploads = await Promise.all(
        DOCUMENTS.map(async (d) => ({ name: d.name, url: await signedUploadUrl(`${folder}/${files[d.name]}`) })),
      );
    } catch (err) {
      console.error("[application] could not prepare document uploads", err);
      return fail("Something went wrong on our side. Please try again, or contact us directly.");
    }
  }
  const ticket = signTicket({ folder, plate: input.plate, vehicle, files, expires: Date.now() + TICKET_TTL_MS });
  return { status: "ready", ticket, uploads };
}

/** Step 3: saves the application once the documents are uploaded. */
export async function submitApplication(formData: FormData): Promise<ApplicationFormState> {
  if (String(formData.get("company_website") ?? "") !== "") {
    return { status: "success", reference: "AP-RECEIVED", name: String(formData.get("name") ?? "") };
  }

  const ticket = readTicket(String(formData.get("ticket") ?? ""));
  if (!ticket) return fail("This form has expired. Please submit it again.");
  const discard = () => removeFiles(Object.values(ticket.files).map((f) => `${ticket.folder}/${f}`));

  const checked = await validate(formData);
  if (!checked.ok) {
    await discard();
    return checked.error;
  }
  const { input, ipHash, userAgent } = checked;
  if (input.plate !== ticket.plate) {
    await discard();
    return fail("Please submit the form again.", { plate: "The licence plate changed. Please submit again." });
  }

  let documents: ApplicationDocument[] | null = null;
  if (Object.keys(ticket.files).length) {
    const stored = await listFiles(ticket.folder).catch((err) => {
      console.error("[application] could not list uploaded documents", err);
      return [];
    });
    documents = [];
    for (const d of DOCUMENTS) {
      const file = stored.find((f) => f.name === ticket.files[d.name]);
      if (!file) {
        await discard();
        return fail("One of your documents didn't upload. Please try again.", { [d.name]: "This file didn't upload." });
      }
      documents.push({ name: d.name, path: `${ticket.folder}/${file.name}`, size: file.size, contentType: file.contentType });
    }
  }

  const application = await save(input, ticket.vehicle, documents, ipHash, userAgent);
  if (!application) {
    await discard();
    return fail("Something went wrong on our side. Please try again, or contact us directly.");
  }

  after(() => Promise.all([notifyNewApplication(application), confirmApplication(application)]));

  return { status: "success", reference: application.reference, name: application.name.split(" ")[0] };
}

async function save(
  input: ApplicationInput,
  vehicle: RdwVehicle | "unavailable",
  documents: ApplicationDocument[] | null,
  ipHash: string,
  userAgent: string | undefined,
) {
  for (let i = 0; i < 3; i++) {
    try {
      const [saved] = await db
        .insert(schema.driverApplications)
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
          documents,
          ipHash,
          userAgent,
        })
        .returning();
      return saved as DriverApplication;
    } catch (err) {
      // Retry only on a reference collision
      if (!isUniqueViolation(err) || i === 2) {
        console.error("[application] insert failed", err);
        return null;
      }
    }
  }
  return null;
}
