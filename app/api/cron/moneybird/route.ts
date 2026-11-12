import { timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { moneybirdConfigured } from "@/lib/moneybird/config";
import { sweepMoneybird } from "@/lib/moneybird/sync";

/**
 * Run by the server's crontab every ten minutes (docs/server-setup.md):
 *   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" http://127.0.0.1:3000/api/cron/moneybird
 * Finishes Moneybird work a booking change could not, and reads paid / late states back. Needs CRON_SECRET.
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
  if (!moneybirdConfigured()) return NextResponse.json({ ok: true, off: true });
  try {
    const result = await sweepMoneybird();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[moneybird] sweep failed", err);
    return NextResponse.json({ error: "Sweep failed" }, { status: 500 });
  }
}
