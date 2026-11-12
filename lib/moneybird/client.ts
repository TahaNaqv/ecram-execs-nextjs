import "server-only";
import { moneybirdConfig, type MoneybirdConfig } from "./config";

/**
 * A thin client for the parts of Moneybird's API v2 the invoices use. Ids are kept as strings (they are larger than a
 * JavaScript number holds). Moneybird allows 150 requests per 5 minutes; a 429 is retried once after its Retry-After.
 * GET answers may be cached by Moneybird, so a write is always checked by its own response, never by reading back.
 */

export class MoneybirdError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
    message: string,
  ) {
    super(message);
    this.name = "MoneybirdError";
  }
}

export type MoneybirdContact = { id: string; customer_id?: string | null };

export type MoneybirdSalesInvoice = {
  id: string;
  invoice_id: string | null;
  reference: string | null;
  state: string;
  total_price_incl_tax: string;
  total_unpaid: string;
  url: string | null;
  payment_url?: string | null;
  paid_at?: string | null;
  sent_at?: string | null;
  details?: { id: string; total_price_excl_tax_with_discount?: string; tax_rate_id?: string }[];
};

type TaxRate = { id: string; percentage: string | null; tax_rate_type: string; active: boolean; country?: string | null };

function required(): MoneybirdConfig {
  const config = moneybirdConfig();
  if (!config) throw new MoneybirdError(0, null, "Moneybird is not connected");
  return config;
}

function describe(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const b = body as { error?: unknown; errors?: unknown };
    const detail = b.error ?? b.errors;
    if (detail) return `Moneybird ${status}: ${typeof detail === "string" ? detail : JSON.stringify(detail)}`.slice(0, 500);
  }
  return `Moneybird ${status}`;
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function moneybird<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, retried = false): Promise<T> {
  const config = required();
  const res = await fetch(`${config.api}/${config.administrationId}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.token}`,
      Accept: "application/json",
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
    cache: "no-store",
  });
  if (res.status === 429 && !retried) {
    const after = Number(res.headers.get("retry-after"));
    await wait(Math.min(30, Number.isFinite(after) && after > 0 ? after : 5) * 1000);
    return moneybird<T>(method, path, body, true);
  }
  const text = await res.text();
  let parsed: unknown = null;
  let readable = true;
  if (text) {
    try {
      // Moneybird sends its (18-digit) ids as JSON strings, so a plain parse keeps them exact
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
      readable = false;
    }
  }
  if (!res.ok) throw new MoneybirdError(res.status, parsed, describe(res.status, parsed));
  // A success we cannot read must not be taken for an empty answer (an id saved as "undefined")
  if (!readable) throw new MoneybirdError(res.status, null, `Moneybird ${res.status}: unreadable answer`);
  return parsed as T;
}

let taxRates: Promise<{ low: string; high: string }> | null = null;

/** The ids of the Dutch 9% and 21% sales tax rates, looked up once per process. */
export function salesTaxRates(): Promise<{ low: string; high: string }> {
  taxRates ??= moneybird<TaxRate[]>("GET", "tax_rates.json?filter=tax_rate_type:sales_invoice,active:true")
    .then((rates) => {
      const domestic = rates.filter((r) => r.active !== false && !r.country);
      const pick = (pct: number) => domestic.find((r) => Number(r.percentage) === pct)?.id;
      const low = pick(9);
      const high = pick(21);
      if (!low || !high) throw new MoneybirdError(0, null, "Moneybird has no active 9% and 21% sales tax rates");
      return { low: String(low), high: String(high) };
    })
    .catch((err) => {
      taxRates = null;
      throw err;
    });
  return taxRates;
}

export const centsFromMoney = (value: string | number | null | undefined): number => Math.round(Number(value ?? 0) * 100);
export const moneyFromCents = (cents: number): string => (cents / 100).toFixed(2);
