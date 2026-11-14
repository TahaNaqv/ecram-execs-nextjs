import { createServer, type IncomingMessage } from "node:http";

/**
 * A stand-in for the parts of Mollie's API v2 the site uses (lib/mollie), kept in memory, with a checkout page of its own:
 * GET /checkout/<id> offers Pay, Fail and Cancel, each of which sends the customer back to the payment's redirectUrl.
 * The site under test is pointed at it with MOLLIE_API_URL and a test_ key. Controls: POST /__status/<id>/<status> and
 * POST /__refund/<id>/<status> set a payment's or a refund's status as Mollie would.
 */
type Amount = { currency: string; value: string };
export type FakeRefund = { resource: "refund"; id: string; paymentId: string; status: string; amount: Amount; description?: string };
export type FakePayment = {
  resource: "payment";
  id: string;
  mode: "test";
  status: string;
  amount: Amount;
  amountRefunded: Amount;
  description: string;
  redirectUrl: string;
  webhookUrl?: string;
  metadata: Record<string, unknown> | null;
  method: string | null;
  paidAt: string | null;
  isCancelable: boolean;
  _links: { checkout: { href: string } | null; dashboard: { href: string } };
};
export const payments = new Map<string, FakePayment>();
export const refunds = new Map<string, FakeRefund>();
export const mollieCalls: { method: string; path: string; body: unknown; key: string | undefined }[] = [];
const byKey = new Map<string, string>();
let next = 1;

const bodyOf = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });
const cents = (a: Amount) => Math.round(Number(a.value) * 100);
const amount = (c: number): Amount => ({ currency: "EUR", value: (c / 100).toFixed(2) });

function recount(p: FakePayment) {
  const done = [...refunds.values()].filter((r) => r.paymentId === p.id && r.status === "refunded");
  p.amountRefunded = amount(done.reduce((sum, r) => sum + cents(r.amount), 0));
}

export async function startFakeMollie(port: number): Promise<() => Promise<void>> {
  const base = `http://127.0.0.1:${port}`;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", base);
    const raw = await bodyOf(req);
    const body = raw ? JSON.parse(raw) : null;
    const send = (status: number, value?: unknown) => res.writeHead(status, { "content-type": "application/json" }).end(value === undefined ? "" : JSON.stringify(value));
    let m: RegExpMatchArray | null;

    // The customer's side: Mollie's payment page
    if (req.method === "GET" && (m = url.pathname.match(/^\/checkout\/(tr_\w+)$/))) {
      const p = payments.get(m[1]);
      if (!p) return send(404);
      res.writeHead(200, { "content-type": "text/html" }).end(
        `<!doctype html><title>Fake Mollie</title><h1>Pay ${p.amount.value} EUR</h1><p>${p.description}</p>` +
          `<a href="/checkout/${p.id}/paid">Pay</a> <a href="/checkout/${p.id}/failed">Fail</a> <a href="/checkout/${p.id}/canceled">Cancel</a>`,
      );
      return;
    }
    if (req.method === "GET" && (m = url.pathname.match(/^\/checkout\/(tr_\w+)\/(paid|failed|canceled)$/))) {
      const p = payments.get(m[1]);
      if (!p) return send(404);
      Object.assign(p, { status: m[2], paidAt: m[2] === "paid" ? new Date().toISOString() : null, method: "ideal", isCancelable: false, _links: { ...p._links, checkout: null } });
      res.writeHead(302, { location: p.redirectUrl }).end();
      return;
    }
    // Test controls
    if (req.method === "POST" && (m = url.pathname.match(/^\/__status\/(tr_\w+)\/(\w+)$/))) {
      const p = payments.get(m[1]);
      if (p) Object.assign(p, { status: m[2], paidAt: m[2] === "paid" ? new Date().toISOString() : p.paidAt, method: p.method ?? "banktransfer" });
      return send(200, {});
    }
    if (req.method === "POST" && (m = url.pathname.match(/^\/__refund\/(re_\w+)\/(\w+)$/))) {
      const r = refunds.get(m[1]);
      if (r) {
        r.status = m[2];
        const p = payments.get(r.paymentId);
        if (p) recount(p);
      }
      return send(200, {});
    }

    // The API
    const key = req.headers["idempotency-key"] as string | undefined;
    mollieCalls.push({ method: req.method ?? "", path: url.pathname, body, key });
    if (!/^Bearer test_\w{20,}$/.test(req.headers.authorization ?? "")) return send(401, { status: 401, title: "Unauthorized Request", detail: "Missing authentication" });
    if (req.method === "POST" && url.pathname === "/payments") {
      if (key && byKey.has(key)) return send(201, payments.get(byKey.get(key)!));
      const id = `tr_fake${String(next++).padStart(6, "0")}`;
      const p: FakePayment = {
        resource: "payment",
        id,
        mode: "test",
        status: "open",
        amount: body.amount,
        amountRefunded: amount(0),
        description: body.description,
        redirectUrl: body.redirectUrl,
        webhookUrl: body.webhookUrl,
        metadata: body.metadata ?? null,
        method: null,
        paidAt: null,
        isCancelable: true,
        _links: { checkout: { href: `${base}/checkout/${id}` }, dashboard: { href: `${base}/dashboard/${id}` } },
      };
      payments.set(id, p);
      if (key) byKey.set(key, id);
      return send(201, p);
    }
    if ((m = url.pathname.match(/^\/payments\/(tr_\w+)$/))) {
      const p = payments.get(m[1]);
      if (!p) return send(404, { status: 404, title: "Not Found", detail: "No payment exists with token" });
      if (req.method === "GET") return send(200, p);
      if (req.method === "DELETE") {
        if (!p.isCancelable || p.status !== "open") return send(422, { status: 422, title: "Unprocessable Entity", detail: "The payment cannot be canceled" });
        Object.assign(p, { status: "canceled", isCancelable: false, _links: { ...p._links, checkout: null } });
        return send(200, p);
      }
    }
    if (req.method === "POST" && (m = url.pathname.match(/^\/payments\/(tr_\w+)\/refunds$/))) {
      const p = payments.get(m[1]);
      if (!p || p.status !== "paid") return send(422, { status: 422, title: "Unprocessable Entity", detail: "The payment cannot be refunded" });
      if (key && byKey.has(key)) return send(201, refunds.get(byKey.get(key)!));
      const id = `re_fake${String(next++).padStart(6, "0")}`;
      const r: FakeRefund = { resource: "refund", id, paymentId: p.id, status: "pending", amount: body.amount, description: body.description };
      refunds.set(id, r);
      if (key) byKey.set(key, id);
      return send(201, r);
    }
    if (req.method === "GET" && (m = url.pathname.match(/^\/payments\/(tr_\w+)\/refunds\/(re_\w+)$/))) {
      const r = refunds.get(m[2]);
      return r && r.paymentId === m[1] ? send(200, r) : send(404, { status: 404, title: "Not Found", detail: "No refund exists" });
    }
    send(404, { status: 404, title: "Not Found", detail: `no fake for ${req.method} ${url.pathname}` });
  });
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  return () => new Promise<void>((resolve) => server.close(() => resolve()));
}
