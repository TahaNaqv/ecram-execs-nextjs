import "server-only";
import { after } from "next/server";
import { moneybirdConfigured } from "./config";
import { syncBooking, syncBookings, type Delivery } from "./sync";

/**
 * Brings the booking's Moneybird invoice in step once the response has gone out, so a slow Moneybird never holds up the
 * team's click. Call it after the booking's change has been saved. A failure is kept on the invoice's row for the admin,
 * and the cron sweeper (app/api/cron/moneybird) finishes anything that did not get done.
 */
export function syncAfter(requestId: string, opts: { deliver?: Delivery } = {}): void {
  if (!moneybirdConfigured()) return;
  after(async () => {
    try {
      const result = await syncBooking(requestId, opts);
      if (result.status === "failed") console.error(`[moneybird] ${requestId}: ${result.error}`);
    } catch (err) {
      console.error(`[moneybird] ${requestId}: sync failed`, err);
    }
  });
}

/** The same for several bookings, one after the other (one contact in Moneybird, never made twice at once). */
export function syncAfterEach(requestIds: string[]): void {
  if (!moneybirdConfigured() || requestIds.length === 0) return;
  after(() => syncBookings(requestIds));
}
