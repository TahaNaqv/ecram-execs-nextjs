"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireArea } from "@/lib/auth/session";
import { db, schema } from "@/lib/db";
import {
  ACCOUNT_STATUSES,
  DRIVER_TYPES,
  KIWA_CARD_TYPES,
  MEDICAL_STATUSES,
  normaliseBtw,
  normaliseIban,
  normaliseKvk,
  normalisePlate,
} from "@/lib/drivers/compliance";
import { DRIVER_DOCUMENT_KINDS, documentAccepts, maySeePrivate } from "@/lib/drivers/documents";
import { digitsOnly } from "@/lib/phone";
import { listFiles, removeFiles, signedUploadUrl, storageConfigured } from "@/lib/storage";
import { DOCUMENT_TYPES } from "@/lib/partners/criteria";
import { isUniqueViolation } from "@/lib/request-meta";
import { signUploadClaim, verifyUploadClaim } from "@/lib/drivers/upload-claim";

const { drivers: d, driverDocuments: docs, driverVehicles: dv } = schema;

type Result = { ok: true } | { ok: false; error: string };

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v));
const isoDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .refine((v) => v === null || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`))), "Enter a valid date.");
const box = z.preprocess((v) => v === "on" || v === "true", z.boolean());
const phone = z
  .string()
  .trim()
  .transform((v) => digitsOnly(v))
  .refine((v) => v === "" || /^\d{8,15}$/.test(v), "Enter a phone number with 8 to 15 digits.")
  .transform((v) => (v === "" ? null : v));
/** An optional number the team types, checked and cleaned by `check`; empty is null. */
const checked = (check: (v: string) => string | null, message: string) =>
  z
    .string()
    .trim()
    .transform((v, ctx) => {
      if (v === "") return null;
      const clean = check(v);
      if (!clean) ctx.addIssue({ code: "custom", message });
      return clean;
    });

const SECTIONS = {
  core: z.object({
    name: z.string().trim().min(1, "Enter the driver's full legal name.").max(120),
    phone: phone.refine((v) => v !== null, "Enter the driver's mobile number."),
    email: z
      .string()
      .trim()
      .max(200)
      .transform((v) => (v === "" ? null : v.toLowerCase()))
      .refine((v) => v === null || z.email().safeParse(v).success, "Enter a valid email address."),
    address: text(300),
    dateOfBirth: isoDate,
    emergencyName: text(120),
    emergencyPhone: phone,
    driverType: z.enum(DRIVER_TYPES),
    languages: z
      .string()
      .max(300)
      .transform((v) => [...new Set(v.split(",").map((l) => l.trim()).filter(Boolean))].slice(0, 12)),
    bio: text(400),
    securityTrained: box,
  }),
  status: z.object({ accountStatus: z.enum(ACCOUNT_STATUSES), statusNote: text(300) }),
  licence: z.object({
    licenceNumber: text(40),
    licenceCountry: z
      .string()
      .trim()
      .toUpperCase()
      .transform((v) => (v === "" ? null : v))
      .refine((v) => v === null || /^[A-Z]{2}$/.test(v), "Use the two-letter country code, e.g. NL."),
    licenceExpiry: isoDate,
    catB: box,
    catBeCode96: box,
    catDCode95: box,
    code95Expiry: isoDate,
    noPrivateCodes: box,
  }),
  kiwa: z.object({
    kiwaCardNumber: text(40),
    kiwaCardType: z
      .string()
      .transform((v) => (v === "" ? null : v))
      .pipe(z.enum(KIWA_CARD_TYPES).nullable()),
    taxipasExpiry: isoDate,
    cdtCheckedOn: isoDate,
  }),
  vetting: z.object({ vogIssuedOn: isoDate, vogVerified: box, medicalStatus: z.enum(MEDICAL_STATUSES) }),
  agency: z.object({
    agencyName: text(120),
    agencyContact: text(200),
    agencyContractRef: text(80),
    agencyRateTier: text(80),
    timesheetId: text(80),
    evInduction: box,
    trailerInduction: box,
  }),
  business: z.object({
    tradeName: text(160),
    kvk: checked(normaliseKvk, "A KvK number has 8 digits."),
    btwId: checked(normaliseBtw, "Enter the VAT id as NL123456789B01."),
    iban: checked(normaliseIban, "That IBAN does not check out. Please look at it again."),
  }),
  permits: z.object({
    permitNumber: text(40),
    permitExpiry: isoDate,
    ondernemerskaartNumber: text(40),
    ondernemerskaartExpiry: isoDate,
  }),
  insurance: z.object({ insurer: text(120), insurancePolicy: text(80), insuranceExpiry: isoDate }),
} as const;

type Section = keyof typeof SECTIONS;
const PRIVATE_FIELDS = ["address", "dateOfBirth", "iban"] as const;

/** Saves one card of the profile. Each card saves on its own, so a half-filled card never blocks the others. */
export async function saveDriverSection(formData: FormData): Promise<Result> {
  const admin = await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("driverId"));
  const section = z.enum(Object.keys(SECTIONS) as [Section, ...Section[]]).safeParse(formData.get("section"));
  if (!id.success || !section.success) return { ok: false, error: "Invalid form." };
  const shape = SECTIONS[section.data];
  // Unticked checkboxes are not sent: read every key of the card, missing ones as empty
  const input = Object.fromEntries(Object.keys(shape.shape).map((key) => [key, formData.get(key) ?? ""]));
  const parsed = shape.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the form." };
  const values: Record<string, unknown> = { ...parsed.data };
  // Someone who cannot see the private fields cannot clear them either
  if (!maySeePrivate(admin)) for (const key of PRIVATE_FIELDS) delete values[key];
  if (section.data === "core") values.partner = values.driverType === "freelance";
  if (section.data === "licence" && !values.catDCode95) values.code95Expiry = null;
  const [saved] = await db.update(d).set(values).where(eq(d.id, id.data)).returning({ id: d.id });
  if (!saved) return { ok: false, error: "This driver no longer exists." };
  refresh();
  return { ok: true };
}

/** The models (or cars of their own) an agency driver may drive. */
export async function saveAuthorisedModels(formData: FormData): Promise<Result> {
  await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("driverId"));
  if (!id.success) return { ok: false, error: "Invalid form." };
  const models = formData
    .getAll("model")
    .map(String)
    .filter((m) => /^[a-z0-9_-]{1,80}$/i.test(m))
    .slice(0, 40);
  const [saved] = await db.update(d).set({ authorisedModels: [...new Set(models)] }).where(eq(d.id, id.data)).returning({ id: d.id });
  if (!saved) return { ok: false, error: "This driver no longer exists." };
  refresh();
  return { ok: true };
}

// ── Own vehicles (freelance) ──────────────────────────────────────────────────────────────────────────────────

const vehicleSchema = z.object({
  make: z.string().trim().min(1, "Enter the make.").max(60),
  model: text(80),
  colour: text(40),
  plate: z
    .string()
    .transform((v, ctx) => {
      const plate = normalisePlate(v);
      if (!plate) ctx.addIssue({ code: "custom", message: "Enter the licence plate, e.g. 12-ABC-3." });
      return plate ?? "";
    }),
  passengers: z.coerce.number().int().min(1, "Passengers: 1 to 16.").max(16, "Passengers: 1 to 16."),
  luggage: z.coerce.number().int().min(0, "Luggage: 0 to 20 suitcases.").max(20, "Luggage: 0 to 20 suitcases."),
  apkExpiry: isoDate.refine((v) => v !== null, "Enter the APK expiry date."),
});

export async function addDriverVehicle(formData: FormData): Promise<Result> {
  await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("driverId"));
  if (!id.success) return { ok: false, error: "Invalid form." };
  const parsed = vehicleSchema.safeParse(Object.fromEntries(["make", "model", "colour", "plate", "passengers", "luggage", "apkExpiry"].map((k) => [k, formData.get(k) ?? ""])));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Please check the car." };
  const [driver] = await db.select({ id: d.id }).from(d).where(eq(d.id, id.data)).limit(1);
  if (!driver) return { ok: false, error: "This driver no longer exists." };
  await db.insert(dv).values({ driverId: id.data, ...parsed.data });
  refresh();
  return { ok: true };
}

export async function removeDriverVehicle(formData: FormData): Promise<Result> {
  await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("vehicleId"));
  if (!id.success) return { ok: false, error: "Invalid form." };
  await db.delete(dv).where(eq(dv.id, id.data));
  refresh();
  return { ok: true };
}

// ── Photo and scans ───────────────────────────────────────────────────────────────────────────────────────────
// The same two-step upload as booking invoices: a one-time signed link from the server, the browser sends the file straight
// to the document store (which checks type, size, the bytes and free space), then the server records it.

export type DriverUpload = { ok: true; url: string; path: string; claim: string } | { ok: false; error: string };

/** Step one. Every upload gets a folder of its own, so a replacement never collides with the file it replaces. */
export async function prepareDriverUpload(driverId: string, kind: string, contentType: string): Promise<DriverUpload> {
  await requireArea("/admin/drivers");
  if (!z.uuid().safeParse(driverId).success) return { ok: false, error: "Invalid driver." };
  const k = z.enum(DRIVER_DOCUMENT_KINDS).safeParse(kind);
  if (!k.success) return { ok: false, error: "Invalid document." };
  if (!storageConfigured()) return { ok: false, error: "Document storage is not configured." };
  const ext = DOCUMENT_TYPES[contentType];
  if (!ext || !documentAccepts(k.data).includes(contentType)) return { ok: false, error: k.data === "photo" ? "Use a JPG or PNG photo." : "Use a PDF, JPG or PNG file." };
  const path = `${crypto.randomUUID()}/${k.data}.${ext}`;
  return { ok: true, url: await signedUploadUrl(path), path, claim: signUploadClaim(driverId, k.data, path) };
}

/** Step two: the file is stored; record it, and remove the file it replaces once the new one is recorded. */
export async function recordDriverDocument(driverId: string, kind: string, path: string, fileName: string, claim: string): Promise<Result> {
  const admin = await requireArea("/admin/drivers");
  const input = z
    .object({
      driverId: z.uuid(),
      kind: z.enum(DRIVER_DOCUMENT_KINDS),
      path: z.string().regex(/^[0-9a-f-]{36}\/[a-z]{1,20}\.(pdf|jpg|png)$/),
      fileName: z.string().trim().min(1).max(200),
    })
    .safeParse({ driverId, kind, path, fileName });
  if (!input.success) return { ok: false, error: "Invalid upload." };
  // Only the file this driver's own upload link was made for
  if (typeof claim !== "string" || !verifyUploadClaim(claim, input.data.driverId, input.data.kind, input.data.path)) return { ok: false, error: "Invalid upload." };
  const [folder, file] = input.data.path.split("/");
  if (!file.startsWith(`${input.data.kind}.`)) return { ok: false, error: "Invalid upload." };
  // What the store holds, not what the browser says it sent
  const [stored] = (await listFiles(folder)).filter((f) => f.name === file);
  if (!stored) return { ok: false, error: "The file did not arrive. Please try again." };
  const ext = file.split(".")[1];
  const contentType = Object.entries(DOCUMENT_TYPES).find(([, e]) => e === ext)?.[0] ?? "application/octet-stream";
  const displayName = input.data.fileName.replace(/^.*[\\/]/, "").replace(/["\r\n]/g, "").slice(0, 120) || file;

  let replaced: { old: string | null } | null;
  try {
    replaced = await db.transaction(async (tx) => {
      const [driver] = await tx.select({ id: d.id }).from(d).where(eq(d.id, input.data.driverId)).for("update").limit(1);
      if (!driver) return null;
      const [old] = await tx
        .delete(docs)
        .where(and(eq(docs.driverId, driver.id), eq(docs.kind, input.data.kind)))
        .returning({ path: docs.path });
      await tx.insert(docs).values({ driverId: driver.id, kind: input.data.kind, path: input.data.path, fileName: displayName, size: stored.size, contentType, uploadedBy: admin.id });
      return { old: old?.path ?? null };
    });
  } catch (err) {
    // The same upload recorded twice (a double click): the first record stands
    if (isUniqueViolation(err)) return { ok: false, error: "That file is already recorded." };
    throw err;
  }
  if (!replaced) {
    await removeFiles([input.data.path]);
    return { ok: false, error: "This driver no longer exists." };
  }
  if (replaced.old && replaced.old !== input.data.path) await removeFiles([replaced.old]);
  refresh();
  return { ok: true };
}

export async function removeDriverDocument(formData: FormData): Promise<Result> {
  await requireArea("/admin/drivers");
  const id = z.uuid().safeParse(formData.get("documentId"));
  if (!id.success) return { ok: false, error: "Invalid form." };
  const [gone] = await db.delete(docs).where(eq(docs.id, id.data)).returning({ path: docs.path });
  if (gone) await removeFiles([gone.path]);
  refresh();
  return { ok: true };
}

class NotFound extends Error {}

/**
 * Permanently erases a driver: the profile, shifts, links, own cars, photo and scans (e.g. a GDPR erasure request). Owners
 * only. Archiving stays the everyday way to take someone off the board; this cannot be undone.
 */
export async function eraseDriver(formData: FormData) {
  const admin = await requireArea("/admin/drivers");
  if (admin.role !== "owner") return { ok: false as const, error: "Only an owner can erase a driver." };
  const id = z.uuid().safeParse(formData.get("driverId"));
  if (!id.success) return { ok: false as const, error: "Invalid form." };
  const paths = await db.transaction(async (tx) => {
    const files = await tx.select({ path: docs.path }).from(docs).where(eq(docs.driverId, id.data));
    // Their website application goes too, with its scans: an erasure leaves nothing of the person behind
    const applications = await tx
      .delete(schema.driverApplications)
      .where(eq(schema.driverApplications.driverId, id.data))
      .returning({ documents: schema.driverApplications.documents });
    const [gone] = await tx.delete(d).where(eq(d.id, id.data)).returning({ id: d.id });
    if (!gone) throw new NotFound();
    return [...files.map((f) => f.path), ...applications.flatMap((a) => (a.documents ?? []).map((doc) => doc.path))];
  }).catch((err) => {
    if (err instanceof NotFound) return null;
    throw err;
  });
  if (paths === null) return { ok: false as const, error: "This driver no longer exists." };
  await removeFiles(paths);
  console.info(`[admin] driver ${id.data} erased by ${admin.id}`);
  redirect("/admin/drivers");
}
