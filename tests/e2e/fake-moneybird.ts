import { createServer, type IncomingMessage, type Server } from "node:http";

/**
 * A stand-in for the parts of Moneybird's API v2 the site uses (lib/moneybird), kept in memory. Started by the Moneybird
 * and payments specs on their own port; the site under test is pointed at it with MONEYBIRD_API_URL. Administration 123,
 * token "test". Controls: POST /__fail?n=N answers the next N calls with a 503; POST /__pay/<id> marks an invoice paid.
 */
export type Detail = { id: string; description: string; price: string; amount: string; tax_rate_id: string; ledger_account_id: string };
export type Invoice = {
  id: string;
  contact_id: string;
  reference: string;
  state: string;
  invoice_id: string | null;
  prices_are_incl_tax: boolean;
  first_due_interval: number;
  details: Detail[];
  total_price_incl_tax: string;
  total_unpaid: string;
  url: string | null;
  payment_url: string | null;
  sent_at: string | null;
  original_sales_invoice_id: string | null;
  payments?: { id: string; price: string; transaction_identifier?: string }[];
  delivery?: string;
  email_address?: string;
};
export type Contact = Record<string, unknown> & { id: string; customer_id: string };
export const invoices = new Map<string, Invoice>();
export const contacts = new Map<string, Contact>();
export const calls: { method: string; path: string; body: unknown }[] = [];
let nextId = 1000;
let numbers = 0;
let failures = 0;
let server: Server;

const bodyOf = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
const money = (cents: number) => (cents / 100).toFixed(2);
export const centsOfDetails = (details: Detail[]) => details.reduce((sum, d) => sum + Math.round(Number(d.price) * 100) * Number(d.amount), 0);
const recount = (inv: Invoice) => {
  const total = centsOfDetails(inv.details);
  inv.total_price_incl_tax = money(total);
  if (inv.state === "draft") inv.total_unpaid = money(total);
};


export async function startFakeMoneybird(port: number): Promise<() => Promise<void>> {
  server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://fake");
    const raw = await bodyOf(req);
    const body = raw ? JSON.parse(raw) : null;
    const send = (status: number, value?: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(value === undefined ? "" : JSON.stringify(value));
    // Test controls
    if (url.pathname === "/__fail") return ((failures = Number(url.searchParams.get("n") ?? 1)), send(200, {}));
    const pay = url.pathname.match(/^\/__pay\/(\d+)$/);
    if (pay) {
      const inv = invoices.get(pay[1]);
      if (inv) Object.assign(inv, { state: "paid", total_unpaid: "0.0" });
      return send(200, {});
    }
    if (req.headers.authorization !== "Bearer test") return send(401, { error: "Token is invalid" });
    const path = url.pathname.replace(/^\/123\//, "");
    calls.push({ method: req.method ?? "", path, body });
    if (failures > 0) {
      failures--;
      return send(503, { error: "Service unavailable" });
    }
    let m: RegExpMatchArray | null;
    if (req.method === "GET" && path === "tax_rates.json")
      return send(200, [
        { id: "900000000000000009", percentage: "9.0", tax_rate_type: "sales_invoice", active: true, country: null },
        { id: "900000000000000021", percentage: "21.0", tax_rate_type: "sales_invoice", active: true, country: null },
        { id: "900000000000000099", percentage: "21.0", tax_rate_type: "sales_invoice", active: true, country: "DE" },
      ]);
    if (req.method === "GET" && (m = path.match(/^contacts\/customer_id\/(.+)\.json$/))) {
      const found = [...contacts.values()].find((c) => c.customer_id === decodeURIComponent(m![1]));
      return found ? send(200, found) : send(404, { error: "record not found" });
    }
    if (req.method === "POST" && path === "contacts.json") {
      const contact = { ...body.contact, id: String(nextId++) } as Contact;
      contacts.set(contact.id, contact);
      return send(201, contact);
    }
    if (req.method === "PATCH" && (m = path.match(/^contacts\/(\d+)\.json$/))) {
      const contact = contacts.get(m[1]);
      if (!contact) return send(404, { error: "record not found" });
      Object.assign(contact, body.contact);
      return send(200, contact);
    }
    if (req.method === "GET" && (m = path.match(/^sales_invoices\/find_by_reference\/(.+)\.json$/))) {
      const found = [...invoices.values()].find((inv) => inv.reference === decodeURIComponent(m![1]) && !inv.original_sales_invoice_id);
      return found ? send(200, found) : send(404, { error: "record not found" });
    }
    if (req.method === "POST" && path === "sales_invoices.json") {
      const s = body.sales_invoice;
      const inv: Invoice = {
        id: String(nextId++),
        contact_id: s.contact_id,
        reference: s.reference,
        state: "draft",
        invoice_id: null,
        prices_are_incl_tax: s.prices_are_incl_tax,
        first_due_interval: s.first_due_interval,
        details: s.details_attributes.map((d: Omit<Detail, "id">) => ({ ...d, id: String(nextId++) })),
        total_price_incl_tax: "0",
        total_unpaid: "0",
        url: null,
        payment_url: null,
        sent_at: null,
        original_sales_invoice_id: null,
      };
      recount(inv);
      invoices.set(inv.id, inv);
      return send(201, inv);
    }
    if ((m = path.match(/^sales_invoices\/(\d+)\.json$/))) {
      const inv = invoices.get(m[1]);
      if (!inv) return send(404, { error: "record not found" });
      if (req.method === "GET") return send(200, inv);
      if (req.method === "DELETE") return (invoices.delete(inv.id), send(204));
      if (req.method === "PATCH") {
        for (const d of body.sales_invoice.details_attributes ?? []) {
          if (d._destroy) inv.details = inv.details.filter((x) => x.id !== d.id);
          else inv.details.push({ ...d, id: String(nextId++) });
        }
        recount(inv);
        return send(200, inv);
      }
    }
    if (req.method === "PATCH" && (m = path.match(/^sales_invoices\/(\d+)\/send_invoice\.json$/))) {
      const inv = invoices.get(m[1]);
      if (!inv) return send(404, { error: "record not found" });
      const sending = body.sales_invoice_sending;
      Object.assign(inv, {
        state: "open",
        invoice_id: `2026-${String(++numbers).padStart(4, "0")}`,
        sent_at: new Date().toISOString(),
        url: `http://127.0.0.1:${port}/external/${inv.id}`,
        payment_url: `http://127.0.0.1:${port}/pay/${inv.id}`,
        delivery: sending.delivery_method,
        email_address: sending.email_address,
      });
      return send(200, inv);
    }
    if (req.method === "PATCH" && (m = path.match(/^sales_invoices\/(\d+)\/duplicate_creditinvoice\.json$/))) {
      const original = invoices.get(m[1]);
      if (!original) return send(404, { error: "record not found" });
      const credit: Invoice = {
        ...original,
        id: String(nextId++),
        state: "draft",
        invoice_id: null,
        sent_at: null,
        url: null,
        payment_url: null,
        original_sales_invoice_id: original.id,
        details: original.details.map((d) => ({ ...d, id: String(nextId++), price: (-Number(d.price)).toFixed(2) })),
      };
      recount(credit);
      invoices.set(credit.id, credit);
      return send(200, credit);
    }
    if (req.method === "PATCH" && (m = path.match(/^sales_invoices\/(\d+)\/register_payment_creditinvoice\.json$/))) {
      const credit = invoices.get(m[1]);
      const original = credit?.original_sales_invoice_id ? invoices.get(credit.original_sales_invoice_id) : null;
      if (!credit || !original) return send(422, { error: "not a credit invoice" });
      const back = -Math.round(Number(credit.total_price_incl_tax) * 100);
      const left = Math.round(Number(original.total_unpaid) * 100) - back;
      Object.assign(original, { total_unpaid: money(left), state: left === 0 ? "paid" : original.state });
      Object.assign(credit, { total_unpaid: "0.0", state: "paid" });
      return send(200, credit);
    }
    if (req.method === "POST" && (m = path.match(/^sales_invoices\/(\d+)\/payments\.json$/))) {
      const inv = invoices.get(m[1]);
      if (!inv) return send(404, { error: "record not found" });
      const payment = { id: String(nextId++), ...body.payment };
      inv.payments = [...(inv.payments ?? []), payment];
      const left = Math.round(Number(inv.total_unpaid) * 100) - Math.round(Number(body.payment.price) * 100);
      Object.assign(inv, { total_unpaid: money(left), state: left === 0 ? "paid" : inv.state });
      return send(201, payment);
    }
    send(404, { error: `no fake for ${req.method} ${path}` });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
