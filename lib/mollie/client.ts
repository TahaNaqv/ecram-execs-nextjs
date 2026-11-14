import "server-only";
import { mollieConfig, type MollieConfig } from "./config";

/** A thin client for the parts of Mollie's API v2 the payments use. Amounts are strings with two decimals, in euros. */

export class MollieError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "MollieError";
  }
}

type Amount = { currency: string; value: string };
export type MolliePayment = {
  id: string;
  mode: "test" | "live";
  status: string;
  amount: Amount;
  amountRefunded?: Amount;
  amountChargedBack?: Amount;
  method: string | null;
  isCancelable?: boolean;
  paidAt?: string | null;
  metadata?: { requestId?: string } | null;
  _links?: { checkout?: { href: string } | null; dashboard?: { href: string } | null };
};
export type MollieRefund = { id: string; status: string; amount: Amount; paymentId?: string };

function required(): MollieConfig {
  const config = mollieConfig();
  if (!config) throw new MollieError(0, null, "Mollie is not connected");
  return config;
}

export async function mollie<T>(method: "GET" | "POST" | "DELETE", path: string, body?: unknown, idempotencyKey?: string): Promise<T> {
  const config = required();
  const res = await fetch(`${config.api}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.key}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  const text = await res.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }
  if (!res.ok) {
    const detail = parsed && typeof parsed === "object" ? (parsed as { detail?: string; title?: string }).detail ?? (parsed as { title?: string }).title : null;
    throw new MollieError(res.status, parsed, `Mollie ${res.status}${detail ? `: ${detail}` : ""}`.slice(0, 500));
  }
  if (text && typeof parsed === "string") throw new MollieError(res.status, null, `Mollie ${res.status}: unreadable answer`);
  return parsed as T;
}

export const centsOf = (amount: Amount | undefined | null): number => (amount ? Math.round(Number(amount.value) * 100) : 0);
export const amountOf = (cents: number): Amount => ({ currency: "EUR", value: (cents / 100).toFixed(2) });
