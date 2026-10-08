"use server";

import { createHash, randomInt } from "node:crypto";
import { and, count, eq, gt } from "drizzle-orm";
import { headers } from "next/headers";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import { confirmToClient, notifyNewQuote } from "@/lib/email";
import { quoteSchema, type QuoteField } from "./validation";

export type QuoteFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<QuoteField, string>>;
      values: Record<string, string>;
      attempt: number;
    }
  | { status: "success"; reference: string; name: string };

const FIELDS = ["collection", "destination", "pickupAt", "service", "passengers", "name", "email", "phone", "notes"] as const;
const RATE_LIMIT = { max: 5, windowMinutes: 15 };
const REF_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O, 1/I/L

const makeReference = () =>
  "EE-" + Array.from({ length: 6 }, () => REF_ALPHABET[randomInt(REF_ALPHABET.length)]).join("");

export async function submitQuote(prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const attempt = prev.status === "error" ? prev.attempt + 1 : 1;
  const fail = (message: string, fieldErrors: Partial<Record<QuoteField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values, attempt }) as const;

  // Honeypot: real visitors never see or fill this field
  if (String(formData.get("company_website") ?? "") !== "") {
    return { status: "success", reference: "EE-RECEIVED", name: values.name };
  }

  const parsed = quoteSchema.safeParse({
    ...values,
    passengers: values.passengers || undefined,
    notes: values.notes || undefined,
  });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<QuoteField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as QuoteField;
      fieldErrors[key] ??= issue.message;
    }
    return fail("Please check the highlighted details.", fieldErrors);
  }

  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const ipHash = createHash("sha256")
    .update(`${process.env.IP_HASH_SALT ?? "ecram-execs"}:${ip}`)
    .digest("hex");

  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000);
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(schema.quoteRequests)
    .where(and(eq(schema.quoteRequests.ipHash, ipHash), gt(schema.quoteRequests.createdAt, since)));
  if (recent >= RATE_LIMIT.max) {
    return fail("We have received several requests from you already — we will be in touch shortly. For anything urgent, please call us.");
  }

  let saved: QuoteRequest | undefined;
  for (let i = 0; i < 3 && !saved; i++) {
    try {
      [saved] = await db
        .insert(schema.quoteRequests)
        .values({
          ...parsed.data,
          reference: makeReference(),
          ipHash,
          userAgent: h.get("user-agent")?.slice(0, 300),
        })
        .returning();
    } catch (err) {
      // Retry only on a reference collision
      if ((err as { cause?: { code?: string } }).cause?.code !== "23505" || i === 2) {
        console.error("[quote] insert failed", err);
        return fail("Something went wrong on our side. Please try again, or call us directly.");
      }
    }
  }
  const request = saved!;
  await db.insert(schema.requestEvents).values({ requestId: request.id, message: "Request received via website" });

  after(() => Promise.all([notifyNewQuote(request), confirmToClient(request)]));

  return { status: "success", reference: request.reference, name: request.name.split(" ")[0] };
}
