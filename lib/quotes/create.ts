import "server-only";
import { db, schema } from "@/lib/db";
import type { QuoteRequest } from "@/lib/db/schema";
import { isUniqueViolation, makeReference } from "@/lib/request-meta";
import { clashingReference, lockFleet } from "@/lib/fleet/availability";

/** A booking was saved as confirmed for a car that another confirmed booking already holds at that time. */
export class CarClashError extends Error {
  constructor(readonly reference: string) {
    super(`The car is already booked on ${reference}`);
  }
}

type NewQuoteRequest = Omit<typeof schema.quoteRequests.$inferInsert, "id" | "reference">;
type NewEvent = Omit<typeof schema.requestEvents.$inferInsert, "id" | "requestId">;

/**
 * Saves a request with a fresh reference and its first timeline events (by default "received"), together: a request
 * never exists without its history. The website, the portal and the team's own booking form all save through here.
 *
 * A booking saved as confirmed holds its car, so it is refused (CarClashError) when another confirmed booking already
 * holds that car at that time. The look and the save happen together under the fleet lock.
 *
 * References are random, so two can collide; the whole transaction is then retried with a new one (a failed insert
 * cannot be retried inside the transaction it broke). Any other error is thrown for the caller to log and report.
 */
export async function createQuoteRequest(values: NewQuoteRequest, events: NewEvent[] = [{ event: "received" }]): Promise<QuoteRequest> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await db.transaction(async (tx) => {
        if (values.status === "confirmed") {
          await lockFleet(tx);
          const clash = await clashingReference(tx, {
            vehicle: values.vehicle ?? null,
            pickupAt: values.pickupAt ?? null,
            returnAt: values.returnAt ?? null,
            service: values.service,
            durationHours: values.durationHours ?? null,
          });
          if (clash) throw new CarClashError(clash);
        }
        const [request] = await tx
          .insert(schema.quoteRequests)
          .values({ ...values, reference: makeReference("EE") })
          .returning();
        if (events.length > 0) await tx.insert(schema.requestEvents).values(events.map((e) => ({ ...e, requestId: request.id })));
        return request;
      });
    } catch (err) {
      if (!isUniqueViolation(err) || attempt === 3) throw err;
    }
  }
}
