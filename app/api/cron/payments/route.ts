import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { mollieConfigured } from "@/lib/mollie/config";
import { sweepPayments } from "@/lib/mollie/pay";

/**
 * Run by the server's crontab every ten minutes (docs/server-setup.md):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/payments
 * Follows online payments and refunds at Mollie and records paid ones in Moneybird. Needs CRON_SECRET.
 */
function authorised(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const wanted = Buffer.from(`Bearer ${secret}`);
  return given.length === wanted.length && timingSafeEqual(given, wanted);
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  if (!mollieConfigured()) return NextResponse.json({ ok: true, off: true });
  try {
    return NextResponse.json({ ok: true, ...(await sweepPayments()) });
  } catch (err) {
    console.error("[mollie] sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
