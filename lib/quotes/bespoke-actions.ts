"use server";

import { and, count, eq, gt } from "drizzle-orm";
import { after } from "next/server";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import { confirmToClient, notifyNewQuote } from "@/lib/email";
import { isUniqueViolation, makeReference, visitor } from "@/lib/request-meta";
import { dictionaryFromForm } from "@/lib/i18n/get-dictionary";
import { bespokeSchema, type BespokeField } from "./bespoke-validation";

export type BespokeFormState =
  | { status: "idle" }
  | {
      status: "error";
      message: string;
      fieldErrors: Partial<Record<BespokeField, string>>;
      values: Record<string, string>;
      attempt: number;
    }
  | { status: "success"; reference: string; name: string };

const FIELDS = ["name", "entity", "entityKvk", "email", "phone", "passengers", "vehicleClass", "contactPreference", "itinerary", "locale"] as const;
// Shares the quote form's window: both write to the same table, so one visitor gets one budget.
const RATE_LIMIT = { max: 5, windowMinutes: 15 };

/**
 * A bespoke inquiry is stored as a `quote_requests` row with `service = 'bespoke'`, so it reaches the
 * same admin list, status pipeline, audit trail and team alert as every other request.
 */
export async function submitBespoke(prev: BespokeFormState, formData: FormData): Promise<BespokeFormState> {
  const { forms: t } = await dictionaryFromForm(formData);
  const values = Object.fromEntries(FIELDS.map((f) => [f, String(formData.get(f) ?? "")]));
  const attempt = prev.status === "error" ? prev.attempt + 1 : 1;
  const fail = (message: string, fieldErrors: Partial<Record<BespokeField, string>> = {}) =>
    ({ status: "error", message, fieldErrors, values, attempt }) as const;

  // Honeypot: real visitors never see or fill this field
  if (String(formData.get("company_website") ?? "") !== "") {
    return { status: "success", reference: "EE-RECEIVED", name: values.name };
  }

  const parsed = bespokeSchema(t).safeParse({ ...values, passengers: values.passengers || undefined, entityKvk: values.entityKvk || undefined });
  if (!parsed.success) {
    const fieldErrors: Partial<Record<BespokeField, string>> = {};
    for (const issue of parsed.error.issues) {
      const key = issue.path[0] as BespokeField;
      fieldErrors[key] ??= issue.message;
    }
    return fail(t.checkHighlighted, fieldErrors);
  }

  const { ipHash, userAgent } = await visitor();

  const since = new Date(Date.now() - RATE_LIMIT.windowMinutes * 60_000);
  const [{ recent }] = await db
    .select({ recent: count() })
    .from(schema.quoteRequests)
    .where(and(eq(schema.quoteRequests.ipHash, ipHash), gt(schema.quoteRequests.createdAt, since)));
  if (recent >= RATE_LIMIT.max) {
    return fail(t.quoteRateLimited);
  }

  let saved: QuoteRequest | undefined;
  for (let i = 0; i < 3 && !saved; i++) {
    try {
      [saved] = await db
        .insert(schema.quoteRequests)
        .values({
          ...parsed.data,
          service: "bespoke",
          source: "website-bespoke",
          reference: makeReference("EE"),
          ipHash,
          userAgent,
        })
        .returning();
    } catch (err) {
      // Retry only on a reference collision
      if (!isUniqueViolation(err) || i === 2) {
        console.error("[bespoke] insert failed", err);
        return fail(t.quoteServerError);
      }
    }
  }
  const request = saved!;
  await db.insert(schema.requestEvents).values({ requestId: request.id, event: "received" });

  after(() => Promise.all([notifyNewQuote(request), confirmToClient(request)]));

  return { status: "success", reference: request.reference, name: request.name.split(" ")[0] };
}
