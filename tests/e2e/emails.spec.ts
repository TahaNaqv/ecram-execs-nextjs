import { createServer, type IncomingMessage, type Server } from "node:http";
import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import { PASSWORD, bookingRow, newEmail, ownAddress, seedBooking, seedContact, signedInPartner, submit } from "./corporate-helpers";
import { fillAdminLogin } from "./helpers";

/**
 * What the team and the people they work for are emailed, checked against a stand-in for Resend that this file starts.
 * The server under test must be started with it as its mail provider, so these only run when asked to:
 *
 *   RESEND_API_KEY=test RESEND_API_URL=http://127.0.0.1:4599/emails EMAIL_FROM="Ecram <noreply@e2e.test>" \
 *   NOTIFY_EMAIL_TO=team@e2e.test E2E_FAKE_RESEND=4599 npx playwright test emails
 *
 * (and `next start` must pick up the same variables, which it does when Playwright starts it from that shell).
 */
const PORT = Number(process.env.E2E_FAKE_RESEND ?? 0);
test.skip(!PORT, "Set E2E_FAKE_RESEND (and the Resend variables, see the top of this file) to run the email tests");
test.describe.configure({ mode: "serial" });

type Sent = { to: string[]; subject: string; html: string; idempotencyKey: string | undefined };
const received: Sent[] = [];
const attempts: (string | undefined)[] = []; // the idempotency key of every request, those answered with an error included
let failures = 0; // answer the next N requests with a server error
let server: Server;

const bodyOf = (req: IncomingMessage) =>
  new Promise<string>((resolve) => {
    let data = "";
    req.on("data", (chunk) => (data += chunk));
    req.on("end", () => resolve(data));
  });

test.beforeAll(async () => {
  server = createServer(async (req, res) => {
    const mail = JSON.parse(await bodyOf(req));
    attempts.push(req.headers["idempotency-key"] as string | undefined);
    if (failures > 0) {
      failures--;
      res.writeHead(503).end(JSON.stringify({ message: "try again" }));
      return;
    }
    received.push({ to: mail.to, subject: mail.subject, html: mail.html, idempotencyKey: req.headers["idempotency-key"] as string | undefined });
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ id: `fake-${received.length}` }));
  });
  await new Promise<void>((resolve) => server.listen(PORT, "127.0.0.1", resolve));
});
test.afterAll(() => new Promise<void>((resolve) => server?.close(() => resolve())));

/** The emails that arrive for one test: they are sent after the response, so wait for them. */
async function mailTo(address: string, count = 1) {
  await expect.poll(() => received.filter((m) => m.to.includes(address)).length, { timeout: 20_000 }).toBeGreaterThanOrEqual(count);
  return received.filter((m) => m.to.includes(address));
}

async function adminSignIn(page: Page) {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

/** The pick-up that a booking some hours from now has, as the text the form and database use. */
function inHours(hours: number) {
  const at = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Amsterdam", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(Date.now() + hours * 3_600_000));
  return at.replace(" ", "T");
}

test("moving a booking from New to Contacted emails the partner; moving it back does not", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("contacted");
  const contactId = await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  const booking = await seedBooking({ contactId, email, status: "new" });

  await adminSignIn(page);
  await page.goto(`/admin/requests/${booking.id}`);
  await page.selectOption("#req-status", "contacted");
  await page.getByRole("button", { name: en.admin.common.save }).click();

  const [mail] = await mailTo(email);
  expect(mail.subject).toBe(en.email.bookingSubjectContacted.replace("{reference}", booking.reference));
  expect(mail.html).toContain(booking.reference);
  expect(mail.html).toContain("corporate-partner/account/booking");

  // Contacted back to new is the team correcting itself, not news for the partner
  await page.reload();
  await page.selectOption("#req-status", "new");
  await page.getByRole("button", { name: en.admin.common.save }).click();
  await page.waitForTimeout(2_500);
  expect(received.filter((m) => m.to.includes(email))).toHaveLength(1);
});

test("a booking the team enters is confirmed to the person it is for, once, unless the box is unticked", async ({ page, context }) => {
  test.slow();
  await ownAddress(context);
  const guest = newEmail("guest");
  const silent = newEmail("silent");
  const partnerEmail = newEmail("partner-confirmed");
  const partnerId = await seedContact(partnerEmail, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");

  async function create(fields: { email?: string; contactId?: string; status?: string; notify?: boolean; locale?: string }) {
    await page.goto("/admin/requests/new");
    if (fields.contactId) await page.selectOption("#nb-contactId", fields.contactId);
    await page.fill("#nb-collection", "Eindhoven Airport");
    await page.locator("input[name=destinations]").first().fill("Amsterdam Zuid");
    await page.fill("#nb-pickupAt", "2031-04-02T09:15");
    if (fields.email) {
      await page.fill("#nb-name", "Caller By Phone");
      await page.fill("#nb-email", fields.email);
    }
    await page.fill("#nb-phone", "6 1234 5678");
    if (fields.status) await page.selectOption("#nb-status", fields.status);
    if (fields.locale) await page.selectOption("#nb-locale", fields.locale);
    if (fields.notify === false) await page.getByLabel(en.admin.newBooking.notifyClient).uncheck();
    await page.getByRole("button", { name: en.admin.newBooking.submit }).click();
    await expect(page).toHaveURL(/\/admin\/requests\/[0-9a-f-]{36}$/);
  }

  await adminSignIn(page);

  // A plain new booking for someone who is not a partner: they are told it was recorded, in the language chosen
  await create({ email: guest, locale: "nl" });
  const [recorded] = await mailTo(guest);
  expect(recorded.subject).toMatch(/^Uw boeking bij Ecram Execs EE-/);
  expect(recorded.html).toContain("Eindhoven Airport");
  expect(recorded.html).toContain("Amsterdam Zuid");
  expect(recorded.html).not.toContain("corporate-partner/account/booking"); // no portal for a guest

  // Unticked: nothing is sent
  await create({ email: silent, notify: false });
  await page.waitForTimeout(2_500);
  expect(received.filter((m) => m.to.includes(silent))).toHaveLength(0);

  // A partner's booking that is already confirmed gets the confirmation mail, and not a second "recorded" one besides
  await create({ contactId: partnerId, status: "confirmed" });
  await mailTo(partnerEmail);
  await page.waitForTimeout(2_500);
  const toPartner = received.filter((m) => m.to.includes(partnerEmail));
  expect(toPartner).toHaveLength(1);
  expect(toPartner[0].subject).toMatch(/is confirmed$/);
});

test("anything a partner writes about a trip within 24 hours is flagged urgent for the team; a distant trip is not", async ({ page, context }) => {
  test.slow();
  const { email, contactId } = await signedInPartner(page, context, "urgent");
  const soon = await seedBooking({ contactId, email, status: "confirmed", pickupAt: inHours(5) });
  const later = await seedBooking({ contactId, email, status: "confirmed", pickupAt: inHours(72) });

  for (const booking of [soon, later]) {
    await page.goto(`/en/corporate-partner/account/booking?ref=${booking.reference}`);
    await page.getByLabel(en.portal.labelMessage).fill("Please add a child seat.");
    await submit(page, en.portal.sendMessage);
    await expect(page.getByText("Please add a child seat.")).toBeVisible();
  }

  await expect.poll(() => received.filter((m) => m.subject.includes(soon.reference)).length, { timeout: 20_000 }).toBeGreaterThan(0);
  await expect.poll(() => received.filter((m) => m.subject.includes(later.reference)).length, { timeout: 20_000 }).toBeGreaterThan(0);
  const urgent = received.find((m) => m.subject.includes(soon.reference))!;
  expect(urgent.subject).toMatch(/^\[URGENT\] /);
  expect(urgent.html).toContain("Pick-up within 24 hours");
  expect(received.find((m) => m.subject.includes(later.reference))!.subject).not.toContain("URGENT");

  // And the team sees it flagged in the list and on the request (the list is drawn twice, a table and a stack, one of them hidden)
  const urgentBadge = () => page.getByText(en.admin.requests.urgent, { exact: true }).locator("visible=true");
  await adminSignIn(page);
  await page.goto(`/admin?q=${soon.reference}`);
  await expect(urgentBadge().first()).toBeVisible();
  await page.goto(`/admin?q=${later.reference}`);
  await expect(page.getByText(later.reference).locator("visible=true").first()).toBeVisible();
  await expect(urgentBadge()).toHaveCount(0);
  await page.goto(`/admin/requests/${soon.id}`);
  await expect(urgentBadge().first()).toBeVisible();
});

test("a send that fails for a moment is tried again with the same idempotency key, and arrives once", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("retry");
  const contactId = await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  const booking = await seedBooking({ contactId, email, status: "new" });

  await adminSignIn(page);
  await page.goto(`/admin/requests/${booking.id}`);
  failures = 2; // the first two attempts get a 503
  await page.selectOption("#req-status", "contacted");
  await page.getByRole("button", { name: en.admin.common.save }).click();

  const mails = await mailTo(email);
  expect(mails).toHaveLength(1);
  // Three requests for one message: two refused, one accepted, all under the same key so Resend could never send it twice
  const mine = attempts.slice(-3);
  expect(mine).toHaveLength(3);
  expect(new Set(mine).size).toBe(1);
  expect(mine[0]).toMatch(/^[0-9a-f-]{36}$/);
  expect(failures).toBe(0);
});

/** Saves the status (and, when given, the amount) the way the team does, and waits until the booking has it. */
async function setStatus(page: Page, booking: { id: string; reference: string }, status: string, amount?: string) {
  await page.goto(`/admin/requests/${booking.id}`);
  await page.selectOption("#req-status", status);
  if (amount !== undefined) await page.fill("#req-amount", amount);
  await page.getByRole("button", { name: en.admin.common.save }).click();
  await expect.poll(async () => (await bookingRow(booking.reference))?.status, { timeout: 20_000 }).toBe(status);
}

test("every step the team takes on a partner's booking emails the partner what it should, and only that", async ({ page, context }) => {
  test.slow();
  await ownAddress(context);
  const email = newEmail("lifecycle");
  const contactId = await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  const booking = await seedBooking({ contactId, email, status: "new" });
  const mails = () => received.filter((m) => m.to.includes(email));
  const ref = (subject: string) => subject.replace("{reference}", booking.reference);
  await adminSignIn(page);

  await setStatus(page, booking, "contacted");
  await mailTo(email, 1);
  // A quote with no amount is nothing to answer yet
  await setStatus(page, booking, "quoted");
  await page.waitForTimeout(2_500);
  expect(mails()).toHaveLength(1);
  // The amount arrives: the quote is ready. A different amount on the same quote is a new offer.
  await setStatus(page, booking, "quoted", "185");
  await mailTo(email, 2);
  await setStatus(page, booking, "quoted", "200");
  await mailTo(email, 3);
  // Notes alone are the team's own business
  await page.goto(`/admin/requests/${booking.id}`);
  await page.fill("#req-notes", "Called the booker, will confirm tomorrow");
  await page.getByRole("button", { name: en.admin.common.save }).click();
  await page.waitForTimeout(2_500);
  expect(mails()).toHaveLength(3);
  await setStatus(page, booking, "confirmed");
  await mailTo(email, 4);
  await setStatus(page, booking, "completed");
  await mailTo(email, 5);
  await setStatus(page, booking, "cancelled");
  await mailTo(email, 6);

  expect(mails().map((m) => m.subject)).toEqual([
    ref(en.email.bookingSubjectContacted),
    ref(en.email.bookingSubjectQuoted),
    ref(en.email.bookingSubjectQuoted),
    ref(en.email.bookingSubjectConfirmed),
    ref(en.email.bookingSubjectCompleted),
    ref(en.email.bookingSubjectCancelled),
  ]);
  // The quote mail carries the amount, and every mail links to the booking in the partner's account
  expect(mails()[1].html).toContain("185");
  expect(mails()[2].html).toContain("200");
  for (const m of mails()) expect(m.html).toContain("corporate-partner/account/booking");
});

test("a status change on a public website enquiry emails nobody: there is no account to send a booking update to", async ({ page, context }) => {
  test.slow();
  await ownAddress(context);
  const email = newEmail("public-enquiry");
  const booking = await seedBooking({ contactId: null, email, status: "new" });
  await adminSignIn(page);
  await setStatus(page, booking, "contacted");
  await setStatus(page, booking, "quoted", "185");
  await setStatus(page, booking, "confirmed");
  await setStatus(page, booking, "completed");
  await page.waitForTimeout(3_000);
  expect(received.filter((m) => m.to.includes(email))).toHaveLength(0);
});
