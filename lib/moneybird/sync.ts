import "server-only";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema } from "@/lib/db";
import { CORPORATE_TERM_DAYS, amsterdamToday } from "@/lib/admin/financials-shared";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import { isCorporateBooking } from "@/lib/quotes/audience";
import { centsFromMoney, moneybird, moneyFromCents, MoneybirdError, salesTaxRates, type MoneybirdContact, type MoneybirdSalesInvoice } from "./client";
import { moneybirdConfig } from "./config";
import {
  creditSplit,
  dueInDays,
  guestCustomerId,
  invoiceCents,
  invoiceLines,
  invoiceReference,
  partnerCustomerId,
  splitName,
} from "./invoice";
import { INVOICE_WORDS } from "./words";
import { hasOnlinePayment, hasUnrecordedPayment, recordingOn } from "./recording";

/**
 * Keeps a booking's Moneybird invoice in step with the booking (the client's choice, 13 Nov 2026):
 * - confirmed (or completed) and no invoice yet: make one, check its total, and send it;
 * - out of confirmed before it was sent: the unsent draft is removed;
 * - cancelled after it was sent: nothing until the team chooses a full credit or a cancellation fee (creditBooking).
 *
 * Only bookings made or confirmed from the moment Moneybird was connected are invoiced by themselves (see `eligibleSql`);
 * an older one is invoiced only when the team asks for it on the booking's page.
 *
 * Every step can be run again. Each row is worked on under a lease (`claimed_at`, 5 minutes), so a status change and the
 * sweeper never work on the same invoice at once, and a crash only delays the work until the lease runs out. Each
 * Moneybird id is saved the moment Moneybird returns it, so a rerun picks up where the last one stopped instead of making
 * a second invoice. A failure never undoes the booking's own change: it is kept on the row (`last_error`) for the admin.
 */

const t = schema.moneybirdInvoices;
const LEASE_MINUTES = 5;
/** A booking confirmed this long before the first Moneybird call still counts as confirmed after it went live. */
const GRACE_MINUTES = 15;
/** Moneybird's states for an invoice that has been sent. */
const SENT_STATES = ["open", "scheduled", "pending_payment", "reminded", "late", "paid", "uncollectible"] as const;
/** Sent but not settled: the sweeper asks Moneybird about these. */
const OPEN_STATES = ["open", "scheduled", "pending_payment", "reminded", "late"] as const;
/** Errors that a retry cannot fix until something changes; the sweeper leaves them to the team. */
export const LASTING_ERRORS = ["billing_missing", "no_amount", "total_mismatch", "rejected", "fee_too_high"] as const;
const SINCE_KEY = "moneybird_since";

export type Delivery = "Email" | "Manual";
type Row = typeof t.$inferSelect;
type Booking = typeof schema.quoteRequests.$inferSelect;
type Partner = typeof schema.corporateContacts.$inferSelect;
export type SyncResult = { status: "off" | "busy" | "missing" | "skipped" | "done" | "waiting" | "failed"; error?: string };

export const isSent = (row: Pick<Row, "number" | "sentAt" | "state">) =>
  Boolean(row.number || row.sentAt || (SENT_STATES as readonly string[]).includes(row.state));
const invoiceSent = (inv: MoneybirdSalesInvoice) => isSent({ number: inv.invoice_id, sentAt: null, state: inv.state });

const describeError = (err: unknown): string => {
  if (err instanceof MoneybirdError) {
    // A 4xx other than a rate limit or a missing record will not pass on a second try: it needs a person
    const lasting = err.status >= 400 && err.status < 500 && err.status !== 429 && err.status !== 404;
    return `${lasting ? "rejected: " : ""}${err.message}`.slice(0, 500);
  }
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
};

const lastingSql = () =>
  sql.join(
    LASTING_ERRORS.map((code) => sql`${t.lastError} like ${`${code}%`}`),
    sql` or `,
  );
const leaseFreeSql = () => sql`(${t.claimedAt} is null or ${t.claimedAt} < now() - make_interval(mins => ${LEASE_MINUTES}))`;

/**
 * When Moneybird went live: MONEYBIRD_SINCE when the server sets it, else the moment this code first ran with Moneybird
 * connected (kept in app_settings). Delete that setting (or set MONEYBIRD_SINCE) when Moneybird is connected again after
 * a pause, or the bookings confirmed during the pause are invoiced too.
 */
async function goLive(): Promise<string> {
  const fixed = process.env.MONEYBIRD_SINCE?.trim();
  if (fixed && Number.isFinite(Date.parse(fixed))) return new Date(fixed).toISOString();
  await db
    .insert(schema.appSettings)
    .values({ key: SINCE_KEY, value: { at: new Date().toISOString() } })
    .onConflictDoNothing();
  const [row] = await db.select({ value: schema.appSettings.value }).from(schema.appSettings).where(eq(schema.appSettings.key, SINCE_KEY)).limit(1);
  const at = (row?.value as { at?: string } | undefined)?.at;
  return at && Number.isFinite(Date.parse(at)) ? at : new Date().toISOString();
}

/**
 * SQL for a quote_requests row aliased `q`: it is Moneybird's to invoice by itself. It was invoiced before, or it was made
 * or confirmed (by the team, or by a partner accepting a quote) after Moneybird went live. A booking confirmed earlier and
 * only completed now is not: it was not invoiced through Moneybird, and is left to the team.
 */
function eligibleSql(since: string) {
  const from = sql`(${since}::timestamptz - make_interval(mins => ${GRACE_MINUTES}))`;
  return sql`(
    exists (select 1 from ${t} m where m.request_id = q.id)
    or q.created_at >= ${from}
    or exists (
      select 1 from ${schema.requestEvents} e
      where e.request_id = q.id
        and e.created_at >= ${from}
        and (
          e.event = 'partner_accepted'
          or (e.event = 'changes' and e.params->'changes' @> '[{"kind":"status","to":"confirmed"}]'::jsonb)
        )
    )
  )`;
}

/** Whether the booking is invoiced by itself (otherwise only when the team asks for it on its page). */
export async function invoiceEligible(requestId: string): Promise<boolean> {
  if (!moneybirdConfig()) return false;
  const since = await goLive();
  const [row] = await db.execute<{ ok: boolean }>(sql`select ${eligibleSql(since)} as ok from ${schema.quoteRequests} q where q.id = ${requestId}`);
  return Boolean(row?.ok);
}

/** Takes the row's lease (free, or left by a run that stopped): the row as it now is, or null when someone holds it. */
export async function lease(id: string): Promise<Row | null> {
  const [row] = await db
    .update(t)
    .set({ claimedAt: new Date() })
    .where(and(eq(t.id, id), leaseFreeSql()))
    .returning();
  return row ?? null;
}

const save = (id: string, patch: Partial<Row>) => db.update(t).set({ ...patch, updatedAt: new Date() }).where(eq(t.id, id));
export const release = (id: string, patch: Partial<Row> = {}) => save(id, { ...patch, claimedAt: null });

export function fromInvoice(inv: MoneybirdSalesInvoice): Partial<Row> {
  const state = String(inv.state);
  return {
    moneybirdId: String(inv.id),
    number: inv.invoice_id ?? null,
    state,
    totalCents: centsFromMoney(inv.total_price_incl_tax),
    unpaidCents: centsFromMoney(inv.total_unpaid),
    url: inv.url ?? null,
    paymentUrl: inv.payment_url ?? inv.url ?? null,
    sentAt: inv.sent_at ? new Date(inv.sent_at) : (SENT_STATES as readonly string[]).includes(state) ? new Date() : null,
    paidAt: state === "paid" ? (inv.paid_at ? new Date(inv.paid_at) : new Date()) : null,
  };
}

async function logEvent(requestId: string | null, event: "mb_invoice" | "mb_credit", number: string | null, adminId: string | null = null) {
  if (!requestId) return;
  await db.insert(schema.requestEvents).values({ requestId, adminId, event, params: { number: number ?? undefined } });
}

async function loadBooking(requestId: string): Promise<{ r: Booking; partner: Partner | null } | null> {
  const [r] = await db.select().from(schema.quoteRequests).where(eq(schema.quoteRequests.id, requestId)).limit(1);
  if (!r) return null;
  const [partner] = r.corporateContactId
    ? await db.select().from(schema.corporateContacts).where(eq(schema.corporateContacts.id, r.corporateContactId)).limit(1)
    : [];
  return { r, partner: partner ?? null };
}

async function bookingStatus(requestId: string): Promise<string | null> {
  const [row] = await db.select({ status: schema.quoteRequests.status }).from(schema.quoteRequests).where(eq(schema.quoteRequests.id, requestId)).limit(1);
  return row?.status ?? null;
}

const invoiceable = (status: string | null) => status === "confirmed" || status === "completed";

export async function liveInvoice(requestId: string): Promise<Row | null> {
  const [row] = await db
    .select()
    .from(t)
    .where(and(eq(t.requestId, requestId), eq(t.kind, "invoice"), isNull(t.creditedAt)))
    .limit(1);
  return row ?? null;
}

/** What a partner's invoice needs before it may be sent: a Dutch invoice to a company carries its address. */
export const billingComplete = (p: Pick<Partner, "billingStreet" | "billingPostcode" | "billingCity">) =>
  Boolean(p.billingStreet?.trim() && p.billingPostcode?.trim() && p.billingCity?.trim());

async function findContact(customerId: string): Promise<MoneybirdContact | null> {
  try {
    return await moneybird<MoneybirdContact>("GET", `contacts/customer_id/${encodeURIComponent(customerId)}.json`);
  } catch (err) {
    if (err instanceof MoneybirdError && err.status === 404) return null;
    throw err;
  }
}

/** Makes the contact, or adopts the one another run made at the same moment (the customer number is then taken). */
async function createContact(customerId: string, fields: Record<string, unknown>): Promise<MoneybirdContact> {
  try {
    return await moneybird<MoneybirdContact>("POST", "contacts.json", { contact: { ...fields, customer_id: customerId } });
  } catch (err) {
    if (err instanceof MoneybirdError && err.status >= 400 && err.status < 500) {
      const found = await findContact(customerId);
      if (found) return found;
    }
    throw err;
  }
}

/** The Moneybird contact the invoice is addressed to: the partner's company, or the guest (and their company, if given). */
async function ensureContact(r: Booking, partner: Partner | null): Promise<string> {
  if (partner) {
    const fields = {
      company_name: partner.companyName?.trim() || partner.name,
      ...(partner.companyName?.trim() ? {} : splitName(partner.name)),
      address1: partner.billingStreet,
      zipcode: partner.billingPostcode,
      city: partner.billingCity,
      country: partner.billingCountry || "NL",
      phone: partner.phone ?? undefined,
      chamber_of_commerce: partner.kvkNumber ?? undefined,
      tax_number: partner.vatNumber ?? undefined,
      send_invoices_to_email: partner.invoiceEmail || partner.email,
      send_invoices_to_attention: partner.name,
      delivery_method: "Email",
    };
    let id = partner.moneybirdContactId;
    if (id) {
      try {
        await moneybird("PATCH", `contacts/${id}.json`, { contact: fields });
      } catch (err) {
        // Removed in Moneybird meanwhile: make it again below
        if (!(err instanceof MoneybirdError && err.status === 404)) throw err;
        id = null;
      }
    }
    if (!id) {
      const customerId = partnerCustomerId(partner.id);
      const found = await findContact(customerId);
      if (found) await moneybird("PATCH", `contacts/${found.id}.json`, { contact: fields });
      const contact = found ?? (await createContact(customerId, fields));
      id = String(contact.id);
      await db.update(schema.corporateContacts).set({ moneybirdContactId: id }).where(eq(schema.corporateContacts.id, partner.id));
    }
    return id;
  }
  const customerId = guestCustomerId(r.email, r.entity);
  const found = await findContact(customerId);
  if (found) return String(found.id);
  const name = splitName(r.name);
  const created = await createContact(customerId, {
    ...(r.entity?.trim() ? { company_name: r.entity.trim(), send_invoices_to_attention: r.name } : {}),
    firstname: name.firstname || undefined,
    lastname: name.lastname || r.name,
    chamber_of_commerce: r.entityKvk ?? undefined,
    phone: r.phone || undefined,
    send_invoices_to_email: r.email,
    delivery_method: "Email",
  });
  return String(created.id);
}

async function findByReference(reference: string): Promise<MoneybirdSalesInvoice | null> {
  try {
    const inv = await moneybird<MoneybirdSalesInvoice & { original_sales_invoice_id?: string | null }>(
      "GET",
      `sales_invoices/find_by_reference/${encodeURIComponent(reference)}.json`,
    );
    // A credit invoice copies the reference of the invoice it credits: never adopt one as the booking's invoice
    if (!inv || inv.original_sales_invoice_id || centsFromMoney(inv.total_price_incl_tax) < 0) return null;
    return inv;
  } catch (err) {
    if (err instanceof MoneybirdError && err.status === 404) return null;
    throw err;
  }
}

export async function getInvoice(id: string): Promise<MoneybirdSalesInvoice | null> {
  try {
    return await moneybird<MoneybirdSalesInvoice>("GET", `sales_invoices/${id}.json`);
  } catch (err) {
    if (err instanceof MoneybirdError && err.status === 404) return null;
    throw err;
  }
}

async function deleteDraft(id: string): Promise<void> {
  try {
    await moneybird("DELETE", `sales_invoices/${id}.json`);
  } catch (err) {
    if (!(err instanceof MoneybirdError && err.status === 404)) throw err;
  }
}

async function createDraft(r: Booking, partner: Partner | null, row: Row, cents: number): Promise<MoneybirdSalesInvoice> {
  const config = moneybirdConfig()!;
  const [contactId, rates, dict] = await Promise.all([ensureContact(r, partner), salesTaxRates(), getDictionary(r.locale as Locale)]);
  const lines = invoiceLines(
    {
      reference: row.reference,
      service: r.service,
      collection: r.collection,
      destination: r.destination,
      durationHours: r.durationHours,
      pickupAt: r.pickupAt,
      returnAt: r.returnAt,
      passengers: r.passengers,
      vehicle: r.vehicle,
      vehicles: r.vehicles,
      locale: r.locale as Locale,
      quotedAmount: r.quotedAmount,
      priceEstimate: r.priceEstimate ?? null,
    },
    { services: dict.services, addOns: dict.addOns },
    cents,
  );
  const corporate = Boolean(partner) || isCorporateBooking(r);
  return moneybird<MoneybirdSalesInvoice>("POST", "sales_invoices.json", {
    sales_invoice: {
      contact_id: contactId,
      reference: row.reference,
      currency: "EUR",
      prices_are_incl_tax: true,
      first_due_interval: dueInDays(corporate, r.pickupAt, amsterdamToday(), CORPORATE_TERM_DAYS),
      details_attributes: lines.map((line) => ({
        description: line.description,
        price: moneyFromCents(line.cents),
        amount: "1",
        tax_rate_id: line.rate === "low" ? rates.low : rates.high,
        ledger_account_id: line.ledger === "rides" ? config.ledgerRides : config.ledgerExtras,
      })),
    },
  });
}

async function send(inv: MoneybirdSalesInvoice, delivery: Delivery, email: string): Promise<MoneybirdSalesInvoice> {
  return moneybird<MoneybirdSalesInvoice>("PATCH", `sales_invoices/${inv.id}/send_invoice.json`, {
    sales_invoice_sending: delivery === "Email" ? { delivery_method: "Email", email_address: email } : { delivery_method: "Manual" },
  });
}

const recipient = (r: Booking, partner: Partner | null) => (partner ? partner.invoiceEmail || partner.email : r.email);

async function rowHasId(id: string): Promise<boolean> {
  const [row] = await db.select({ id: t.moneybirdId }).from(t).where(eq(t.id, id)).limit(1);
  return Boolean(row?.id);
}

/** Makes (or finishes) the booking's invoice on a leased row. */
async function issue(row: Row, r: Booking, partner: Partner | null): Promise<SyncResult> {
  const cents = invoiceCents({ quotedAmount: r.quotedAmount, priceEstimate: r.priceEstimate ?? null });
  if (cents == null) {
    await release(row.id, { state: row.moneybirdId ? row.state : "failed", lastError: "no_amount" });
    return { status: "failed", error: "no_amount" };
  }
  if (partner && !billingComplete(partner)) {
    await release(row.id, { state: row.moneybirdId ? row.state : "failed", lastError: "billing_missing" });
    return { status: "failed", error: "billing_missing" };
  }
  try {
    let inv: MoneybirdSalesInvoice | null = row.moneybirdId ? await getInvoice(row.moneybirdId) : await findByReference(row.reference);
    if (inv && invoiceSent(inv)) {
      await release(row.id, { ...fromInvoice(inv), lastError: null });
      await logEvent(row.requestId, "mb_invoice", inv.invoice_id);
      return { status: "done" };
    }
    // A draft that no longer adds up (the price changed before it was sent) is made again
    if (inv && centsFromMoney(inv.total_price_incl_tax) !== cents) {
      await deleteDraft(String(inv.id));
      await save(row.id, { moneybirdId: null, state: "claimed" });
      inv = null;
    }
    if (!inv) {
      inv = await createDraft(r, partner, row, cents);
      await save(row.id, { moneybirdId: String(inv.id), state: "draft", totalCents: centsFromMoney(inv.total_price_incl_tax) });
    }
    const total = centsFromMoney(inv.total_price_incl_tax);
    if (total !== cents) {
      const error = `total_mismatch: Moneybird ${moneyFromCents(total)}, booking ${moneyFromCents(cents)}`;
      await release(row.id, { state: "failed", lastError: error });
      return { status: "failed", error };
    }
    // The booking may have been cancelled while the invoice was being made: then it is not sent
    if (!invoiceable(await bookingStatus(r.id))) {
      await deleteDraft(String(inv.id));
      await release(row.id, { state: "void", creditedAt: new Date(), lastError: null });
      return { status: "done" };
    }
    const sent = await send(inv, (row.delivery as Delivery) ?? "Email", recipient(r, partner));
    await release(row.id, { ...fromInvoice(sent), lastError: null });
    await logEvent(row.requestId, "mb_invoice", sent.invoice_id);
    return { status: "done" };
  } catch (err) {
    const error = describeError(err);
    console.error(`[moneybird] invoice for ${row.reference} failed:`, error);
    await release(row.id, { state: (await rowHasId(row.id)) ? "draft" : "failed", lastError: error });
    return { status: "failed", error };
  }
}

/** An invoice that was never sent, for a booking that is no longer confirmed: nothing was invoiced, so it simply goes. */
async function voidUnsent(row: Row): Promise<SyncResult> {
  try {
    const inv = row.moneybirdId ? await getInvoice(row.moneybirdId) : await findByReference(row.reference);
    if (inv && invoiceSent(inv)) {
      // It was sent after all (a run that stopped before it could save that): keep it, and let the team credit it
      await release(row.id, { ...fromInvoice(inv), lastError: null });
      return { status: "waiting" };
    }
    if (inv) await deleteDraft(String(inv.id));
    await release(row.id, { state: "void", creditedAt: new Date(), lastError: null });
    return { status: "done" };
  } catch (err) {
    const error = describeError(err);
    await release(row.id, { lastError: error });
    return { status: "failed", error };
  }
}

/**
 * Brings the booking's invoice in step with its status. Safe to call any number of times, from any path that changes a
 * booking (always after the change is saved). `deliver` says how a new invoice reaches the customer: by Moneybird's email,
 * or "Manual" (numbered and booked, but not emailed) when the team chose not to notify them. `force` invoices a booking
 * confirmed before Moneybird went live, when the team asks for it.
 */
export async function syncBooking(requestId: string, opts: { deliver?: Delivery; force?: boolean } = {}): Promise<SyncResult> {
  if (!moneybirdConfig()) return { status: "off" };
  const status = await bookingStatus(requestId);
  if (status == null) return { status: "missing" };
  const live = await liveInvoice(requestId);

  let row: Row | null = null;
  if (invoiceable(status)) {
    if (live && isSent(live)) return { status: "done" };
    if (live) {
      row = await lease(live.id);
      if (!row) return { status: "busy" };
      if (opts.deliver && !row.moneybirdId && opts.deliver !== row.delivery) {
        await save(row.id, { delivery: opts.deliver });
        row = { ...row, delivery: opts.deliver };
      }
    } else {
      if (!opts.force && !(await invoiceEligible(requestId))) return { status: "skipped" };
      const [last] = await db
        .select({ attempt: t.attempt })
        .from(t)
        .where(and(eq(t.requestId, requestId), eq(t.kind, "invoice")))
        .orderBy(desc(t.attempt))
        .limit(1);
      const attempt = (last?.attempt ?? 0) + 1;
      const [booking] = await db.select({ reference: schema.quoteRequests.reference }).from(schema.quoteRequests).where(eq(schema.quoteRequests.id, requestId)).limit(1);
      if (!booking) return { status: "missing" };
      [row] = await db
        .insert(t)
        .values({
          requestId,
          reference: invoiceReference(booking.reference, attempt),
          attempt,
          kind: "invoice",
          state: "claimed",
          delivery: opts.deliver ?? "Email",
          claimedAt: new Date(),
        })
        .onConflictDoNothing()
        .returning();
      if (!row) return { status: "busy" };
    }
  } else {
    if (!live || isSent(live)) return { status: live ? "waiting" : "done" };
    row = await lease(live.id);
    if (!row) return { status: "busy" };
  }

  // Read the booking again under the lease: it may have changed while the lease was being taken
  const leased = row;
  let loaded: Awaited<ReturnType<typeof loadBooking>>;
  try {
    loaded = await loadBooking(requestId);
  } catch (err) {
    await release(leased.id);
    throw err;
  }
  if (!loaded) {
    await release(leased.id);
    return { status: "missing" };
  }
  if (!invoiceable(loaded.r.status)) {
    if (!isSent(leased)) return voidUnsent(leased);
    await release(leased.id);
    return { status: "waiting" };
  }
  return issue(leased, loaded.r, loaded.partner);
}

/** One sync after the other, for several bookings at once (a partner's billing details arriving). */
export async function syncBookings(requestIds: string[]): Promise<void> {
  for (const id of requestIds) {
    const result = await syncBooking(id).catch((err) => ({ status: "failed" as const, error: describeError(err) }));
    if (result.status === "failed") console.error(`[moneybird] ${id}: ${result.error}`);
  }
}

type CreditDetail = { id: string; price?: string; amount?: string; tax_rate_id?: string; ledger_account_id?: string };

/**
 * Credits the sent invoice of a cancelled booking: all of it (`feeCents` 0), or all but the cancellation fee the team keeps.
 * The credit is sent the way the invoice was. When the invoice was not paid, the two are settled against each other so
 * Moneybird stops sending reminders (only the fee, if any, stays open). When it was paid, the money is refunded by hand.
 * Until the credit has gone out, the team may change their mind about the fee: the unsent credit is made again.
 */
export async function creditBooking(requestId: string, feeCents: number, adminId: string | null): Promise<SyncResult> {
  if (!moneybirdConfig()) return { status: "off" };
  if ((await bookingStatus(requestId)) !== "cancelled") return { status: "failed", error: "not_cancelled" };
  const live = await liveInvoice(requestId);
  if (!live || !isSent(live) || !live.moneybirdId) return { status: "failed", error: "nothing_to_credit" };
  // A payment taken online but not yet recorded on the invoice: record it first (lib/mollie), or the credit would
  // settle an invoice the customer had already paid
  if (recordingOn() && (await hasUnrecordedPayment(requestId))) return { status: "failed", error: "payment_not_recorded" };
  // Not recorded by this site at all (Moneybird matches Mollie itself): never settle against an invoice paid online
  const paidOnlineElsewhere = !recordingOn() && (await hasOnlinePayment(requestId));
  const total = live.totalCents ?? 0;
  const fee = Math.max(0, Math.round(feeCents));
  if (!(await lease(live.id))) return { status: "busy" };
  const originalId = live.moneybirdId;

  let credit: Row | undefined;
  try {
    [credit] = await db.select().from(t).where(and(eq(t.kind, "credit"), eq(t.creditOf, live.id))).limit(1);
    if (!credit || !isSent(credit)) {
      if (fee >= total) {
        await release(live.id);
        return { status: "failed", error: "fee_too_high" };
      }
      if (!credit) {
        [credit] = await db
          .insert(t)
          .values({ requestId, reference: live.reference, attempt: live.attempt, kind: "credit", creditOf: live.id, state: "claimed", delivery: live.delivery, feeCents: fee, claimedAt: new Date() })
          .onConflictDoNothing()
          .returning();
        if (!credit) {
          await release(live.id);
          return { status: "busy" };
        }
      } else if ((credit.feeCents ?? 0) !== fee) {
        // Another choice before it went out: the unsent credit is made again with the new fee
        if (credit.moneybirdId) await deleteDraft(credit.moneybirdId);
        await save(credit.id, { moneybirdId: null, state: "claimed", feeCents: fee, lastError: null });
        credit = { ...credit, moneybirdId: null, state: "claimed", feeCents: fee };
      }
    }
  } catch (err) {
    await release(live.id);
    throw err;
  }

  const creditRow = credit;
  const keep = creditRow.feeCents ?? 0;
  const expected = -(total - keep);
  try {
    let cr: MoneybirdSalesInvoice | null = creditRow.moneybirdId ? await getInvoice(creditRow.moneybirdId) : null;
    let sentNow = false;
    if (!isSent(creditRow)) {
      if (!cr) {
        cr = await moneybird<MoneybirdSalesInvoice>("PATCH", `sales_invoices/${originalId}/duplicate_creditinvoice.json`, {});
        await save(creditRow.id, { moneybirdId: String(cr.id), state: "draft" });
      }
      if (!invoiceSent(cr) && keep > 0 && centsFromMoney(cr.total_price_incl_tax) !== expected) {
        // Keep the fee: the credit's lines become what is given back per VAT rate and ledger account, the fee taken
        // from each in proportion. A credit line has a positive price and a negative amount ("-1 x"), or the reverse.
        const groups = new Map<string, { taxRateId: string; ledgerId: string; cents: number }>();
        for (const d of (cr.details ?? []) as CreditDetail[]) {
          const cents = -Math.round(Number(d.price ?? 0) * Number.parseFloat(d.amount ?? "1") * 100);
          if (!cents) continue;
          const key = `${d.tax_rate_id}|${d.ledger_account_id}`;
          const group = groups.get(key) ?? { taxRateId: String(d.tax_rate_id), ledgerId: String(d.ledger_account_id), cents: 0 };
          group.cents += cents;
          groups.set(key, group);
        }
        const [booking] = await db.select({ locale: schema.quoteRequests.locale }).from(schema.quoteRequests).where(eq(schema.quoteRequests.id, requestId)).limit(1);
        const words = INVOICE_WORDS[(booking?.locale as Locale) ?? "en"];
        const label = `${words.credit(live.number ?? live.reference)} (${words.cancellationFee}: € ${moneyFromCents(keep)})`;
        cr = await moneybird<MoneybirdSalesInvoice>("PATCH", `sales_invoices/${cr.id}.json`, {
          sales_invoice: {
            details_attributes: [
              ...((cr.details ?? []) as CreditDetail[]).map((d) => ({ id: d.id, _destroy: true })),
              ...creditSplit([...groups.values()], keep).map((g) => ({
                description: label,
                price: moneyFromCents(-g.cents),
                amount: "1",
                tax_rate_id: g.taxRateId,
                ledger_account_id: g.ledgerId,
              })),
            ],
          },
        });
      }
      if (!invoiceSent(cr)) {
        const got = centsFromMoney(cr.total_price_incl_tax);
        if (got !== expected) {
          const error = `total_mismatch: credit ${moneyFromCents(got)}, expected ${moneyFromCents(expected)}`;
          await release(creditRow.id, { state: "failed", lastError: error });
          await release(live.id);
          return { status: "failed", error };
        }
        const loaded = await loadBooking(requestId);
        cr = await send(cr, (creditRow.delivery as Delivery) ?? "Email", loaded ? recipient(loaded.r, loaded.partner) : "");
        sentNow = true;
      }
      await save(creditRow.id, { ...fromInvoice(cr), feeCents: keep, lastError: null });
    }
    // Settle an unpaid invoice with its credit so the reminders stop (what stays open is the fee). Safe to repeat:
    // once settled, the credit has nothing left open.
    let original = await getInvoice(originalId);
    if (cr && original && !paidOnlineElsewhere && original.state !== "paid" && centsFromMoney(original.total_unpaid) > 0 && centsFromMoney(cr.total_unpaid) !== 0) {
      cr = await moneybird<MoneybirdSalesInvoice>("PATCH", `sales_invoices/${cr.id}/register_payment_creditinvoice.json`, {});
      original = (await getInvoice(originalId)) ?? original;
    }
    await release(creditRow.id, { ...(cr ? fromInvoice(cr) : {}), feeCents: keep, lastError: null });
    await release(live.id, { ...(original ? fromInvoice(original) : {}), creditedAt: new Date(), lastError: null });
    if (sentNow) await logEvent(requestId, "mb_credit", cr?.invoice_id ?? null, adminId);
    return { status: "done" };
  } catch (err) {
    const error = describeError(err);
    console.error(`[moneybird] credit for ${live.reference} failed:`, error);
    const [now] = await db.select().from(t).where(eq(t.id, creditRow.id)).limit(1);
    // A credit that went out keeps its state; only the error is noted, and the sweeper finishes the settling
    await release(creditRow.id, now && isSent(now) ? { lastError: error } : { state: now?.moneybirdId ? "draft" : "failed", lastError: error });
    await release(live.id);
    return { status: "failed", error };
  }
}

/** Reads a sent invoice's state from Moneybird again (paid, late, reminded …). */
async function refresh(row: Row): Promise<void> {
  if (!row.moneybirdId || !(await lease(row.id))) return;
  try {
    const inv = await getInvoice(row.moneybirdId);
    // Removed in Moneybird by the accountant: keep our record, say so
    await release(row.id, inv ? { ...fromInvoice(inv), lastError: null } : { lastError: "rejected: removed in Moneybird" });
  } catch (err) {
    await release(row.id, { lastError: describeError(err) });
  }
}

/**
 * Run by cron every ten minutes (app/api/cron/moneybird): finishes work a status change could not (Moneybird down, the
 * server restarted mid-way), settles credits that went out but were not settled, invoices a booking confirmed since
 * Moneybird went live that was never picked up, and reads paid / late states back.
 */
export async function sweepMoneybird(limit = 40): Promise<{ retried: number; picked: number; refreshed: number }> {
  if (!moneybirdConfig()) return { retried: 0, picked: 0, refreshed: 0 };
  const since = await goLive();
  let retried = 0;
  let picked = 0;
  let refreshed = 0;

  // Unfinished rows, leaving out those only the team can fix
  const stuck = await db
    .select()
    .from(t)
    .where(and(isNotNull(t.requestId), inArray(t.state, ["claimed", "draft", "failed"]), leaseFreeSql(), sql`(${t.lastError} is null or not (${lastingSql()}))`))
    .orderBy(asc(t.updatedAt))
    .limit(limit);
  for (const row of stuck) {
    retried++;
    if (row.kind === "credit") await creditBooking(row.requestId!, row.feeCents ?? 0, null);
    else await syncBooking(row.requestId!);
  }

  // Credits that went out while the invoice they credit was not yet marked: settle it and mark it
  const unsettled = await db.execute<{ request_id: string; fee_cents: number | null }>(sql`
    select c.request_id, c.fee_cents
    from ${t} c join ${t} i on i.id = c.credit_of
    where c.kind = 'credit' and c.number is not null and i.credited_at is null and c.request_id is not null
    limit ${limit}
  `);
  for (const row of unsettled) {
    retried++;
    await creditBooking(row.request_id, row.fee_cents ?? 0, null);
  }

  const missing = await db.execute<{ id: string }>(sql`
    select q.id
    from ${schema.quoteRequests} q
    where q.status in ('confirmed', 'completed')
      and not exists (select 1 from ${t} m where m.request_id = q.id and m.kind = 'invoice' and m.credited_at is null)
      and ${eligibleSql(since)}
    order by q.updated_at asc
    limit ${limit}
  `);
  for (const { id } of missing) {
    picked++;
    await syncBooking(id);
  }

  const open = await db
    .select()
    .from(t)
    .where(and(isNotNull(t.moneybirdId), inArray(t.state, [...OPEN_STATES]), leaseFreeSql()))
    .orderBy(asc(t.updatedAt))
    .limit(limit);
  for (const row of open) {
    refreshed++;
    await refresh(row);
  }
  return { retried, picked, refreshed };
}

/** The booking's invoices for the admin, newest first. */
export async function invoicesFor(requestId: string): Promise<Row[]> {
  return db.select().from(t).where(eq(t.requestId, requestId)).orderBy(desc(t.createdAt));
}

/**
 * Whether the booking's sent invoice stands in the way of this status: once Moneybird has sent an invoice, the booking can
 * stay confirmed, be completed, or be cancelled (and then credited), but not go back to being an open request.
 */
export async function invoiceBlocksStatus(requestId: string, to: string): Promise<boolean> {
  if (to === "confirmed" || to === "completed" || to === "cancelled") return false;
  const live = await liveInvoice(requestId);
  return Boolean(live && isSent(live));
}

/** A booking whose invoice is out and not paid cannot be deleted: credit it first (cancel the booking), so the books stay right. */
export async function invoiceBlocksDelete(requestId: string): Promise<boolean> {
  const live = await liveInvoice(requestId);
  return Boolean(live && isSent(live) && live.state !== "paid");
}
