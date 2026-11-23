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

/** A fresh id on every call. A counter that restarts at 2000 collides with the unique moneybird_id already stored. */
function mockId() {
  return `mock_${crypto.randomUUID()}`;
}

function mockNumber() {
  return `2026-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
}

function handleMockMoneybird<T>(method: string, path: string, body: unknown): T {
  const reqBody = body as Record<string, unknown> | null | undefined;
  if (method === "GET" && path.startsWith("workflows.json")) {
    return [
      { id: "mock_wf_en", name: "English", language: "en", type: "SalesInvoiceWorkflow", active: true },
      { id: "mock_wf_nl", name: "Nederlands", language: "nl", type: "SalesInvoiceWorkflow", active: true, default: true },
    ] as T;
  }
  if (method === "GET" && path.startsWith("tax_rates.json")) {
    return [
      { id: "mock_tax_9", percentage: "9.0", tax_rate_type: "sales_invoice", active: true, country: null },
      { id: "mock_tax_21", percentage: "21.0", tax_rate_type: "sales_invoice", active: true, country: null },
    ] as T;
  }
  if (method === "GET" && path.includes("contacts/customer_id/")) {
    return { id: "mock_contact_1", customer_id: "mock" } as T;
  }
  if (method === "POST" && path.startsWith("contacts.json")) {
    const contact = reqBody?.contact as Record<string, unknown> | undefined;
    return { id: "mock_contact_1", customer_id: (contact?.customer_id as string) ?? "mock" } as T;
  }
  if (method === "PATCH" && path.startsWith("contacts/")) {
    const contact = reqBody?.contact as Record<string, unknown> | undefined;
    return { id: path.replace(".json", "").split("/")[1], customer_id: "mock", ...contact } as T;
  }
  if (method === "GET" && path.includes("find_by_reference")) {
    throw new MoneybirdError(404, null, "not found");
  }
  if (method === "POST" && path.startsWith("sales_invoices.json")) {
    const s = reqBody?.sales_invoice as Record<string, unknown> | undefined;
    const details = (s?.details_attributes ?? []) as Array<{ price?: string | number; amount?: number }>;
    const total = details.reduce((sum: number, d) => sum + Math.round(Number(d.price ?? 0) * 100) * Number(d.amount ?? 1), 0);
    const moneyStr = (total / 100).toFixed(2);
    const newId = mockId();
    return {
      id: newId,
      invoice_id: null,
      reference: (s?.reference as string) ?? "EE-MOCK",
      state: "draft",
      total_price_incl_tax: moneyStr,
      total_unpaid: moneyStr,
      url: `/api/mock/moneybird/invoice?id=${newId}&view=customer`,
      payment_url: `/api/mock/moneybird/invoice?id=${newId}&view=customer`,
    } as T;
  }
  if (method === "PATCH" && path.includes("/send_invoice.json")) {
    const id = path.split("/")[1];
    return {
      id,
      invoice_id: mockNumber(),
      reference: "EE-MOCK",
      state: "open",
      total_price_incl_tax: "178.63",
      total_unpaid: "178.63",
      url: `/api/mock/moneybird/invoice?id=${id}&view=customer`,
      payment_url: `/api/mock/moneybird/invoice?id=${id}&view=customer`,
      sent_at: new Date().toISOString(),
    } as T;
  }
  if (method === "GET" && path.startsWith("sales_invoices/")) {
    const id = path.replace(".json", "").split("/")[1];
    return {
      id,
      invoice_id: mockNumber(),
      reference: "EE-MOCK",
      state: "open",
      total_price_incl_tax: "178.63",
      total_unpaid: "178.63",
      url: "https://moneybird.com/mock-customer-view",
      payment_url: "https://moneybird.com/mock-pay",
      sent_at: new Date().toISOString(),
    } as T;
  }
  if (method === "PATCH" && path.includes("/duplicate_creditinvoice.json")) {
    return {
      id: mockId(),
      invoice_id: mockNumber(),
      state: "draft",
      total_price_incl_tax: "-178.63",
      total_unpaid: "-178.63",
    } as T;
  }
  if (method === "PATCH" && path.includes("/register_payment_creditinvoice.json")) {
    return {
      id: mockId(),
      state: "paid",
    } as T;
  }
  if (method === "PATCH" && path.startsWith("sales_invoices/")) {
    return {
      id: mockId(),
      state: "open",
    } as T;
  }
  if (method === "DELETE" && path.startsWith("sales_invoices/")) {
    return {} as T;
  }
  return {} as T;
}

export async function moneybird<T>(method: "GET" | "POST" | "PATCH" | "DELETE", path: string, body?: unknown, retried = false): Promise<T> {
  const config = required();
  if (config.token === "mock" || config.token.startsWith("mock")) {
    return handleMockMoneybird<T>(method, path, body);
  }
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

export type MoneybirdWorkflow = {
  id: string;
  name: string;
  type?: string | null;
  language?: string | null;
  active?: boolean;
  default?: boolean;
};

let workflowsPromise: Promise<{ en?: string; nl?: string } | null> | null = null;

/** Active sales invoice workflows by language ("en" / "nl"), if configured in Moneybird. */
export function invoiceWorkflows(): Promise<{ en?: string; nl?: string } | null> {
  workflowsPromise ??= moneybird<MoneybirdWorkflow[]>("GET", "workflows.json")
    .then((list) => {
      if (!Array.isArray(list)) return null;
      const active = list.filter((w) => w.active !== false);
      const en = active.find((w) => w.language === "en" || /english|engels/i.test(w.name))?.id;
      const nl = active.find((w) => w.language === "nl" || w.language === "nl-be" || /nederlands|dutch/i.test(w.name))?.id;
      return { en: en ? String(en) : undefined, nl: nl ? String(nl) : undefined };
    })
    .catch(() => {
      workflowsPromise = null;
      return null;
    });
  return workflowsPromise;
}

export const centsFromMoney = (value: string | number | null | undefined): number => Math.round(Number(value ?? 0) * 100);
export const moneyFromCents = (cents: number): string => (cents / 100).toFixed(2);
