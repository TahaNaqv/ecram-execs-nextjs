import "server-only";
import { sql } from "drizzle-orm";
import { cache } from "react";
import { requireAdmin } from "@/lib/auth/session";
import { db } from "@/lib/db";
import type { RequestStatus } from "@/lib/quotes/constants";

/**
 * Enquiry management: every enquiry that arrives through the website, in two queues, each with a time to answer it in.
 *
 * - **standard**: someone asked through the website's booking bar or the bespoke form
 * - **corporate**: a partner with a verified account asked in the portal, or a company sent its introduction. Judged by where the
 *   enquiry came from as well as by the partner link, which can be cleared later (detached by the team, or the partner erased).
 *
 * Bookings the team keyed in themselves (source "admin") and demo rows are not enquiries and are left out.
 */
export type Queue = "standard" | "corporate";

/**
 * How long the team has to give a first answer, in minutes, counted around the clock (the site promises to be available 24/7).
 * One place to change when the client sets other targets.
 */
export const SLA_MINUTES: Record<Queue, number> = { standard: 60, corporate: 60 };

/** An enquiry with less than this long left is "due soon". */
export const DUE_SOON_MINUTES = 15;

/** The averages and the compliance figure look back this far. */
const WINDOW_DAYS = 30;
/** How many waiting enquiries a queue lists (the rest are counted). */
const LIST_LIMIT = 25;

export type OpenEnquiry = {
  id: string;
  reference: string;
  /** The client's name in the standard queue, the company in the corporate one */
  who: string;
  status: RequestStatus;
  pickupAt: string | null;
  returnAt: string | null;
  createdMs: number;
  deadlineMs: number;
};

export type AnsweredEnquiry = {
  id: string;
  reference: string;
  who: string;
  createdMs: number;
  respondedMs: number;
  withinTarget: boolean;
};

export type QueueSummary = {
  queue: Queue;
  targetMinutes: number;
  /** Enquiries still waiting for a first answer */
  newCount: number;
  /** The most urgent of them, soonest deadline first */
  open: OpenEnquiry[];
  /** Average time to a first answer over the last 30 days, or null when nothing was answered */
  avgResponseMs: number | null;
  /** Percentage of the last 30 days' enquiries answered within the target (a waiting one that is already late counts against), or null when there are none */
  compliance: number | null;
  overdue: number;
  dueSoon: number;
  answered: AnsweredEnquiry[];
};

type Row = {
  id: string;
  reference: string;
  name: string;
  entity: string | null;
  company_name: string | null;
  status: RequestStatus;
  pickup_at: string | null;
  return_at: string | null;
  queue: Queue;
  created_ms: number;
  responded_ms: number | null;
};

/**
 * The first answer is the first time the team moved the request on from "new" (recorded in its history). Closing an enquiry
 * without an answer ("cancelled") is not an answer, or clearing out spam would make the team look quick.
 */
const FIRST_ANSWER = sql`(
  select min(e.created_at) from request_events e
  where e.request_id = q.id and e.event = 'changes'
    and jsonb_path_exists(e.params, '$.changes[*] ? (@.kind == "status" && @.from == "new" && @.to != "cancelled")')
)`;

export const enquiryQueues = cache(async (): Promise<{ nowMs: number; standard: QueueSummary; corporate: QueueSummary }> => {
  await requireAdmin();
  const rows = Array.from(
    await db.execute<Row>(sql`
      select q.id, q.reference, q.name, q.entity, q.status::text as status,
             q.pickup_at::text as pickup_at, q.return_at::text as return_at,
             c.company_name,
             case when q.corporate_contact_id is not null or q.source in ('portal', 'website-corporate') then 'corporate' else 'standard' end as queue,
             (extract(epoch from q.created_at) * 1000)::float8 as created_ms,
             (extract(epoch from ${FIRST_ANSWER}) * 1000)::float8 as responded_ms
      from quote_requests q
      left join corporate_contacts c on c.id = q.corporate_contact_id
      where q.source in ('website', 'website-bespoke', 'website-corporate', 'portal')
        and (q.status = 'new' or q.created_at > now() - make_interval(days => ${WINDOW_DAYS}))
      order by q.created_at asc`),
  );
  const nowMs = Date.now();
  return { nowMs, standard: summarise("standard", rows, nowMs), corporate: summarise("corporate", rows, nowMs) };
});

function summarise(queue: Queue, all: Row[], nowMs: number): QueueSummary {
  const targetMs = SLA_MINUTES[queue] * 60_000;
  const dueSoonMs = DUE_SOON_MINUTES * 60_000;
  const rows = all.filter((r) => r.queue === queue);
  const who = (r: Row) => (queue === "corporate" ? (r.company_name ?? r.entity ?? r.name) : r.name);

  const waiting = rows
    .filter((r) => r.status === "new")
    .map((r): OpenEnquiry => ({
      id: r.id,
      reference: r.reference,
      who: who(r),
      status: r.status,
      pickupAt: r.pickup_at,
      returnAt: r.return_at,
      createdMs: r.created_ms,
      deadlineMs: r.created_ms + targetMs,
    }))
    .sort((a, b) => a.deadlineMs - b.deadlineMs);

  const answered = rows
    // One put back to "new" after an answer is waiting again, not answered: it must not be counted in both lists
    .filter((r): r is Row & { responded_ms: number } => r.responded_ms !== null && r.responded_ms >= r.created_ms && r.status !== "new")
    .map((r): AnsweredEnquiry => ({
      id: r.id,
      reference: r.reference,
      who: who(r),
      createdMs: r.created_ms,
      respondedMs: r.responded_ms,
      withinTarget: r.responded_ms - r.created_ms <= targetMs,
    }));

  const late = waiting.filter((w) => w.deadlineMs < nowMs);
  // The figure looks back 30 days: an enquiry forgotten for months still shows as overdue, but does not hold the percentage down for ever
  const lateInWindow = late.filter((w) => w.createdMs > nowMs - WINDOW_DAYS * 86_400_000).length;
  const judged = answered.length + lateInWindow;
  const inTime = answered.filter((a) => a.withinTarget).length;

  return {
    queue,
    targetMinutes: SLA_MINUTES[queue],
    newCount: waiting.length,
    open: waiting.slice(0, LIST_LIMIT),
    avgResponseMs: answered.length ? answered.reduce((sum, a) => sum + (a.respondedMs - a.createdMs), 0) / answered.length : null,
    compliance: judged ? Math.round((inTime / judged) * 100) : null,
    overdue: late.length,
    dueSoon: waiting.filter((w) => w.deadlineMs >= nowMs && w.deadlineMs - nowMs <= dueSoonMs).length,
    answered: answered.sort((a, b) => b.respondedMs - a.respondedMs).slice(0, 5),
  };
}

/** The number of enquiries waiting for a first answer, for the menu. */
export const waitingEnquiries = cache(async () => {
  await requireAdmin();
  const [row] = Array.from(
    await db.execute<{ n: number }>(sql`
      select count(*)::int as n from quote_requests where status = 'new' and source in ('website', 'website-bespoke', 'website-corporate', 'portal')`),
  );
  return row?.n ?? 0;
});
