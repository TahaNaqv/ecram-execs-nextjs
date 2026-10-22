import { readdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import {
  ORIGIN,
  PASSWORD,
  bookingRow,
  logIn,
  newEmail,
  ownAddress,
  seedBooking,
  seedContact,
  signedInPartner,
  sql,
  submit,
  t,
} from "./corporate-helpers";
import { carChoice, chooseCar, fillDetails, fillJourney, nextYear } from "./booking-helpers";
import { fillAdminLogin, CONSENTED_STATE } from "./helpers";

/**
 * The partner portal: what a partner sees and does with their bookings, and what the team does on the other side.
 * Bookings are written straight into the database (like the Corporate Partner spec seeds accounts), so each test
 * starts from exactly the state it describes.
 */
const p = en.portal;
const a = en.admin;
const detail = (reference: string) => `/en/corporate-partner/account/booking?ref=${reference}`;
const pdf = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(300, 7)]);

async function eventsOf(requestId: string) {
  const db = sql();
  try {
    return (await db`select event, params from request_events where request_id = ${requestId} order by created_at`) as unknown as { event: string; params: Record<string, unknown> | null }[];
  } finally {
    await db.end();
  }
}

async function adminSignIn(page: Page) {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
}

test("the bookings are grouped by what the partner has to do, and an introduction is not a booking", async ({ page, context }) => {
  const { email, contactId } = await signedInPartner(page, context, "groups");
  const waiting = await seedBooking({ contactId, email, status: "quoted", quotedAmount: "185.50", destination: "Quoted Destination" });
  const open = await seedBooking({ contactId, email, status: "new", destination: "Open Destination" });
  const done = await seedBooking({ contactId, email, status: "completed", destination: "Done Destination" });
  const intro = await seedBooking({ contactId, email, status: "new", source: "website-corporate", destination: "Introduction" });

  // A quote is waiting, so that is where the list opens
  await page.goto("/en/corporate-partner/account");
  await expect(page.getByText(waiting.reference)).toBeVisible();
  await expect(page.getByText("€185.50")).toBeVisible();
  // A pick-up is the wall-clock time it was booked for, whatever zone the server or the reader is in
  await expect(page.getByText("14 Mar 2031, 08:30")).toBeVisible();
  await expect(page.getByText(open.reference)).toHaveCount(0);

  await page.getByRole("link", { name: new RegExp(`^${p.tabOpen}`) }).click();
  await expect(page.getByText(open.reference)).toBeVisible();
  await expect(page.getByText(intro.reference)).toHaveCount(0);

  await page.getByRole("link", { name: new RegExp(`^${p.tabPast}`) }).click();
  await expect(page.getByText(done.reference)).toBeVisible();

  // The introduction exists, so the prompt to send one is not shown; the counts on the tabs say the same
  await expect(page.getByRole("heading", { name: p.introCtaTitle })).toHaveCount(0);
  await expect(page.getByRole("link", { name: new RegExp(`^${p.tabAnswer} \\(1\\)`) })).toBeVisible();
});

test("a partner with no introduction yet is offered one", async ({ page, context }) => {
  await signedInPartner(page, context, "nointro");
  await page.goto("/en/corporate-partner/account");
  await expect(page.getByRole("heading", { name: p.introCtaTitle })).toBeVisible();
  await expect(page.getByText(p.emptyOpen)).toBeVisible();
});

test("a partner sees only their own bookings", async ({ page, context, browser }) => {
  const mine = await signedInPartner(page, context, "mine");
  const theirs = await seedContact(newEmail("theirs"), PASSWORD, "Someone Else", "Other Company");
  const stranger = await seedBooking({ contactId: theirs, email: "someone@e2e.ecramexecs.test", status: "confirmed", destination: "Strangers Only Street" });
  await seedBooking({ contactId: mine.contactId, email: mine.email, status: "confirmed" });

  // Not in their list, and not reachable by its reference: it answers exactly like a booking that doesn't exist
  await page.goto("/en/corporate-partner/account?tab=open");
  await expect(page.getByText(stranger.reference)).toHaveCount(0);
  await page.goto(detail(stranger.reference));
  await expect(page.getByText(p.bookingNotFound)).toBeVisible();
  await expect(page.getByText("Strangers Only Street")).toHaveCount(0);

  // Nor can it be repeated: the form opens empty
  await page.goto(`/en/corporate-partner/account/new-booking?repeat=${stranger.reference}`);
  await expect(page.locator("main").getByLabel(en.booking.from, { exact: true })).toHaveValue("");

  // The owner can open it
  const ownerContext = await browser.newContext({ baseURL: ORIGIN, storageState: CONSENTED_STATE });
  await ownAddress(ownerContext);
  const owner = await ownerContext.newPage();
  const db = sql();
  const [row] = await db`select email from corporate_contacts where id = ${theirs}`;
  await db.end();
  await logIn(owner, row.email, PASSWORD);
  await owner.goto(detail(stranger.reference));
  await expect(owner.getByText("Strangers Only Street")).toBeVisible();
  await ownerContext.close();
});

test("a booking page asks for sign-in and brings the partner straight back to it", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("deeplink");
  const contactId = await seedContact(email, PASSWORD);
  const booking = await seedBooking({ contactId, email, status: "confirmed" });

  await page.goto(detail(booking.reference));
  await expect(page).toHaveURL(/\/en\/corporate-partner\/login\?next=/);
  await page.fill("#c-email", email);
  await page.fill("#c-password", PASSWORD);
  await submit(page, t.loginCta);
  await expect(page).toHaveURL(new RegExp(`/account/booking\\?ref=${booking.reference}$`));
  await expect(page.getByRole("heading", { name: p.headingBooking.replace("{reference}", booking.reference) })).toBeVisible();
  // The language switch keeps the booking
  await page.getByRole("link", { name: en.switcher.ariaNl }).click();
  await expect(page).toHaveURL(new RegExp(`/nl/zakelijke-partner/account/boeking\\?ref=${booking.reference}$`));
  await expect(page.getByRole("heading", { name: nl.portal.headingBooking.replace("{reference}", booking.reference) })).toBeVisible();
});

test("a login cannot send the partner to another site", async ({ page, context }) => {
  test.slow(); // four sign-ins in a row, each several database round trips
  await ownAddress(context);
  const email = newEmail("redirect");
  await seedContact(email, PASSWORD);
  for (const next of ["https://evil.example/phish", "//evil.example", "/en/corporate-partner/account//evil.example", "/admin"]) {
    await page.goto(`/en/corporate-partner/login?next=${encodeURIComponent(next)}`);
    await page.fill("#c-email", email);
    await page.fill("#c-password", PASSWORD);
    await submit(page, t.loginCta);
    await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);
    await page.getByRole("button", { name: t.signOut }).click();
    await expect(page).toHaveURL(/\/en\/corporate-partner$/);
  }
});

test("a tampered form cannot answer or write to another partner's booking", async ({ page, context }) => {
  const mine = await signedInPartner(page, context, "tamper");
  const strangerId = await seedContact(newEmail("tamper-victim"), PASSWORD, "Someone Else", "Other Company");
  const myQuote = await seedBooking({ contactId: mine.contactId, email: mine.email, status: "quoted", quotedAmount: "100.00" });
  const theirQuote = await seedBooking({ contactId: strangerId, email: "victim@e2e.ecramexecs.test", status: "quoted", quotedAmount: "200.00" });
  const myOpen = await seedBooking({ contactId: mine.contactId, email: mine.email, status: "confirmed" });
  const theirOpen = await seedBooking({ contactId: strangerId, email: "victim@e2e.ecramexecs.test", status: "confirmed" });

  // Accept: the form on my own quote is pointed at their reference and their amount
  await page.goto(detail(myQuote.reference));
  const quoteForm = page.getByRole("region", { name: p.quoteReadyTitle });
  await quoteForm.locator('input[name="reference"]').evaluate((el, value) => ((el as HTMLInputElement).value = value), theirQuote.reference);
  await quoteForm.locator('input[name="amount"]').evaluate((el) => ((el as HTMLInputElement).value = "200.00"));
  await submit(page, p.acceptCta);
  await expect(page.getByText(p.quoteNotOpenError)).toBeVisible();
  expect((await bookingRow(theirQuote.reference))?.status).toBe("quoted");

  // A message: the form on my own booking is pointed at their booking
  await page.goto(detail(myOpen.reference));
  await page.getByRole("region", { name: p.sectionActivity }).locator('input[name="reference"]').evaluate((el, value) => ((el as HTMLInputElement).value = value), theirOpen.reference);
  await page.getByLabel(p.labelMessage).fill("Injected message");
  await submit(page, p.sendMessage);
  await expect(page.getByText(p.messagesClosed)).toBeVisible();
  const db = sql();
  const [{ n }] = await db`select count(*)::int as n from booking_messages where request_id = ${theirOpen.id}`;
  await db.end();
  expect(n).toBe(0);
});

test("accepting a quote confirms the booking, at the amount the partner saw", async ({ page, context }) => {
  const { email, contactId } = await signedInPartner(page, context, "accept");
  const booking = await seedBooking({ contactId, email, status: "quoted", quotedAmount: "185.50" });

  await page.goto(detail(booking.reference));
  await expect(page.getByRole("heading", { name: p.quoteReadyTitle })).toBeVisible();
  await expect(page.getByText("€185.50").first()).toBeVisible();
  await submit(page, p.acceptCta);
  await expect(page.getByRole("heading", { name: p.quoteReadyTitle })).toHaveCount(0);
  await expect(page.getByText(p.statuses.confirmed, { exact: true })).toBeVisible();
  await expect(page.getByText(p.events.accepted.replace("{amount}", "€185.50"))).toBeVisible();

  expect((await bookingRow(booking.reference))?.status).toBe("confirmed");
  expect((await eventsOf(booking.id)).map((e) => e.event)).toContain("partner_accepted");
});

test("a quote that changed while the partner was looking cannot be accepted blind", async ({ page, context }) => {
  test.slow(); // many round trips between three browsers
  const { email, contactId } = await signedInPartner(page, context, "stale");
  const booking = await seedBooking({ contactId, email, status: "quoted", quotedAmount: "100.00" });

  await page.goto(detail(booking.reference));
  await expect(page.getByText("€100.00").first()).toBeVisible();
  // The team changes the price after the page was opened
  const db = sql();
  await db`update quote_requests set quoted_amount = 120.00 where id = ${booking.id}`;
  await db.end();

  await submit(page, p.acceptCta);
  await expect(page.getByText(p.quoteChangedError)).toBeVisible();
  expect((await bookingRow(booking.reference))?.status).toBe("quoted");

  // With the new amount in front of them, they can accept it
  await page.reload();
  await expect(page.getByText("€120.00").first()).toBeVisible();
  await submit(page, p.acceptCta);
  await expect(page.getByText(p.statuses.confirmed, { exact: true })).toBeVisible();
  expect((await bookingRow(booking.reference))?.status).toBe("confirmed");
});

test("declining a quote cancels the booking and keeps the reason for the team", async ({ page, context }) => {
  const { email, contactId } = await signedInPartner(page, context, "decline");
  const booking = await seedBooking({ contactId, email, status: "quoted", quotedAmount: "250.00" });

  await page.goto(detail(booking.reference));
  await page.getByRole("button", { name: p.declineCta }).click();
  await page.getByLabel(p.declineReasonLabel).fill("Over budget this quarter");
  await submit(page, p.declineConfirmCta);
  await expect(page.getByText(p.statuses.cancelled, { exact: true })).toBeVisible();

  expect((await bookingRow(booking.reference))?.status).toBe("cancelled");
  const declined = (await eventsOf(booking.id)).find((e) => e.event === "partner_declined");
  expect(declined?.params).toEqual({ reason: "Over budget this quarter" });
  // What the partner sees of their own history says only that they declined
  await expect(page.getByText(p.events.declined)).toBeVisible();
});

test("a partner can write to the team, ask for a change and ask for a cancellation; a closed booking takes no more", async ({ page, context }) => {
  test.slow(); // many round trips between three browsers
  const { email, contactId } = await signedInPartner(page, context, "messages");
  const open = await seedBooking({ contactId, email, status: "confirmed" });
  const closed = await seedBooking({ contactId, email, status: "completed" });

  await page.goto(detail(open.reference));
  for (const [kind, text] of [
    ["message", "Please add a child seat."],
    ["change", "Can we move the pick-up to 09:00?"],
    ["cancel", "The meeting was cancelled."],
  ] as const) {
    await page.getByLabel(p.labelMessageKind).selectOption(kind);
    await page.getByLabel(p.labelMessage).fill(text);
    await submit(page, p.sendMessage);
    await expect(page.getByText(text)).toBeVisible();
  }
  await expect(page.getByText(p.tagChange)).toBeVisible();
  await expect(page.getByText(p.tagCancel)).toBeVisible();
  // Requests never change the booking themselves: the team does that
  expect((await bookingRow(open.reference))?.status).toBe("confirmed");

  await page.goto(detail(closed.reference));
  await expect(page.getByText(p.messagesClosed)).toBeVisible();
  await expect(page.getByLabel(p.labelMessage)).toHaveCount(0);
});

test("a new booking from the portal carries the partner's details, and can be repeated", async ({ page, context }) => {
  const { contactId } = await signedInPartner(page, context, "newbooking");
  const b = en.booking;

  await page.goto("/en/corporate-partner/account/new-booking");
  // The same flow as the website, inside the portal: the journey first
  await fillJourney(page, {
    from: "Schiphol Airport, Arrivals 2",
    to: "Hotel Des Indes, The Hague",
    at: nextYear("14-03", "08:30"),
    stops: [{ place: "Rotterdam Centraal", wait: 30 }],
    flight: "kl1234",
    pax: 3,
  });
  await chooseCar(page, "Mercedes-Benz VLE 300");
  // The booker is the signed-in partner, shown rather than asked; a PA books for the person travelling
  await expect(page.getByText("Anouk Jansen")).toBeVisible();
  await fillDetails(page, { phone: "6 1234 5678", passenger: { name: "Pieter de Boer", phone: "6 8765 4321" }, notes: "Meet at the KLM desk" });

  await expect(page).toHaveURL(/\/account\/booking\?ref=EE-[A-Z0-9]{6}&created=1$/);
  await expect(page.getByText(p.createdNotice)).toBeVisible();
  const reference = new URL(page.url()).searchParams.get("ref")!;
  // In travelling order: from, the stop on the way, to
  await expect(page.locator("ol li").filter({ hasText: "1. Schiphol Airport, Arrivals 2" })).toBeVisible();
  await expect(page.locator("ol li").filter({ hasText: "2. Rotterdam Centraal" })).toBeVisible();
  await expect(page.locator("ol li").filter({ hasText: "3. Hotel Des Indes, The Hague" })).toBeVisible();
  // The wait is shown at the stop it belongs to, and nowhere else
  await expect(page.locator("ol li").filter({ hasText: "2. Rotterdam Centraal" })).toContainText(p.stopWait.replace("{minutes}", "30"));
  await expect(page.locator("ol li").filter({ hasText: "1. Schiphol Airport, Arrivals 2" })).not.toContainText(p.stopWait.replace(": {minutes} min", ""));
  // The new details are on the booking's page too
  await expect(page.getByText("KL1234")).toBeVisible();
  await expect(page.getByText("Pieter de Boer")).toBeVisible();

  const row = await bookingRow(reference);
  expect(row?.source).toBe("portal");
  expect(row?.corporate_contact_id).toBe(contactId);
  const db = sql();
  const [stored] = await db`select destinations, destination_waits, service, vehicle, passengers, notes, flight_number, passenger_name, name from quote_requests where reference = ${reference}`;
  await db.end();
  expect(stored.destinations).toEqual(["Rotterdam Centraal"]);
  expect(stored.destination_waits).toEqual([30]);
  expect(stored).toMatchObject({ service: "airport_transfer", vehicle: "mercedes_vle_300", passengers: 3, notes: "Meet at the KLM desk", flight_number: "KL1234", passenger_name: "Pieter de Boer", name: "Anouk Jansen" });

  // Repeating starts from the same trip, with no date (and no flight: a new trip, a new flight)
  await page.getByRole("link", { name: p.repeatCta }).click();
  await expect(page.getByText(p.repeatNote.replace("{reference}", reference))).toBeVisible();
  const journey = page.locator("main");
  await expect(journey.getByLabel(b.from, { exact: true })).toHaveValue("Schiphol Airport, Arrivals 2");
  await expect(journey.getByLabel("Stop 1", { exact: true })).toHaveValue("Rotterdam Centraal");
  await expect(journey.getByLabel(b.stopWaitLabel.replace("{number}", "1"))).toHaveValue("30");
  await expect(journey.getByLabel(b.when, { exact: true })).toHaveValue("");
  await expect(journey.getByLabel(b.flight, { exact: true })).toHaveValue("");
  // …and the car and the passenger start from the earlier booking too
  await journey.getByLabel(b.when, { exact: true }).fill(nextYear("21-03", "08:30"));
  await journey.getByRole("button", { name: b.continue }).click();
  await expect(carChoice(page, "Mercedes-Benz VLE 300")).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: /^Continue with/ }).click();
  await expect(page.getByRole("button", { name: b.whoOther })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByLabel(b.passengerName, { exact: true })).toHaveValue("Pieter de Boer");
});

test("the booking flow says what is wrong, and a past date is refused", async ({ page, context }) => {
  await signedInPartner(page, context, "validate");
  await page.goto("/en/corporate-partner/account/new-booking");
  const journey = page.locator("main");
  await journey.getByRole("button", { name: en.booking.continue }).click();
  const alert = journey.getByRole("alert");
  await expect(alert).toContainText(en.forms.collectionRequired);
  await expect(alert).toContainText(en.forms.pickupInvalid);
  await fillJourney(page, { from: "Schiphol", to: "Hotel", at: "01-01-2020 10:00" });
  await expect(alert).toContainText(en.forms.pickupPast);
  await expect(page.getByRole("heading", { name: en.booking.carTitle })).toHaveCount(0);
});

// ── The team's side ──────────────────────────────────────────────────────────────────────────────────────────

test("the team links a request to a partner, they talk, and detaching takes it out of the portal", async ({ page, context, browser }) => {
  test.slow(); // many round trips between three browsers
  await ownAddress(context);
  const email = newEmail("team");
  await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  // A request made on the public form with the partner's address: not linked, because nothing links at submit time
  const request = await seedBooking({ contactId: null, email, status: "quoted", quotedAmount: "300.00", destination: "Admin Linked Street" });

  await adminSignIn(page);
  await page.goto(`/admin/requests/${request.id}`);
  await expect(page.getByText(a.partnerCard.suggest.replace("{name}", "Anouk Jansen"))).toBeVisible();
  await page.getByRole("button", { name: a.partnerCard.attach }).first().click();
  await expect(page.getByText(a.partnerCard.linkedTo, { exact: true })).toBeVisible();
  await expect(page.getByText(a.events.attached.replace("{partner}", "Anouk Jansen"))).toBeVisible();

  // The partner now has it, and writes about it
  const partnerContext = await browser.newContext({ baseURL: ORIGIN, storageState: CONSENTED_STATE });
  await ownAddress(partnerContext);
  const partner = await partnerContext.newPage();
  await logIn(partner, email, PASSWORD);
  await partner.goto(detail(request.reference));
  await expect(partner.getByText("Admin Linked Street")).toBeVisible();
  await partner.getByLabel(p.labelMessageKind).selectOption("cancel");
  await partner.getByLabel(p.labelMessage).fill("We no longer need this transfer.");
  await submit(partner, p.sendMessage);

  // It is flagged in the team's list until someone opens it
  await page.goto(`/admin?q=${request.reference}`);
  // The list is rendered twice (phone and desktop layouts); only one is visible
  await expect(page.getByText(a.requests.partnerMessage).filter({ visible: true })).toBeVisible();
  await page.goto(`/admin/requests/${request.id}`);
  await expect(page.getByText("We no longer need this transfer.")).toBeVisible();
  await expect(page.getByText(a.messages.tagCancel)).toBeVisible();
  await expect(async () => {
    await page.goto(`/admin?q=${request.reference}`);
    await expect(page.getByText(a.requests.partnerMessage)).toHaveCount(0);
  }).toPass();

  // The team replies; the partner sees it
  await page.goto(`/admin/requests/${request.id}`);
  await page.getByLabel(a.messages.replyLabel).fill("Understood, we have cancelled it.");
  await page.getByRole("button", { name: a.messages.send }).click();
  await expect(page.getByText(a.messages.sent)).toBeVisible();
  await partner.reload();
  await expect(partner.getByText("Understood, we have cancelled it.")).toBeVisible();
  await expect(partner.getByText(p.team)).toBeVisible();

  // Detached, it is gone from the portal
  await page.getByRole("button", { name: a.partnerCard.detach }).click();
  await expect(page.getByText(a.partnerCard.notLinked)).toBeVisible();
  await partner.goto(detail(request.reference));
  await expect(partner.getByText(p.bookingNotFound)).toBeVisible();
  await partnerContext.close();
});

test("a request with a partner's messages or invoices can only be attached to that same partner again", async ({ page, context }) => {
  test.slow(); // several admin round trips
  await ownAddress(context);
  const first = await seedContact(newEmail("first"), PASSWORD, "First Partner", "First Co");
  const second = await seedContact(newEmail("second"), PASSWORD, "Second Partner", "Second Co");
  const request = await seedBooking({ contactId: first, email: "someone@e2e.ecramexecs.test", status: "confirmed" });
  const db = sql();
  await db`insert into booking_messages (request_id, author_kind, contact_id, kind, body) values (${request.id}, 'partner', ${first}, 'message', 'First partner only')`;
  await db.end();

  await adminSignIn(page);
  await page.goto(`/admin/requests/${request.id}`);
  await page.getByRole("button", { name: a.partnerCard.detach }).click();
  await expect(page.getByText(a.partnerCard.notLinked)).toBeVisible();
  await expect(page.getByText(a.partnerCard.historyNote)).toBeVisible();
  // Only the partner whose conversation this is can be chosen
  const options = await page.locator("#attach-partner option").allTextContents();
  expect(options.join("|")).toContain("First Partner");
  expect(options.join("|")).not.toContain("Second Partner");

  // And the server says no even to a form that was tampered with
  await page.locator("#attach-partner").evaluate((el, id) => {
    const option = document.createElement("option");
    option.value = id;
    option.text = "tampered";
    el.appendChild(option);
    (el as HTMLSelectElement).value = id;
  }, second);
  await page.getByRole("button", { name: a.partnerCard.attach }).first().click();
  await page.waitForLoadState("networkidle");
  expect((await bookingRow(request.reference))?.corporate_contact_id).toBeNull();

  // The same partner can be attached again
  await page.reload();
  await page.locator("#attach-partner").selectOption(first);
  await page.getByRole("button", { name: a.partnerCard.attach }).first().click();
  await expect(page.getByText(a.partnerCard.linkedTo, { exact: true })).toBeVisible();
});

test("the team cannot overwrite a booking the partner has just answered", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("guard");
  const contactId = await seedContact(email, PASSWORD);
  const request = await seedBooking({ contactId, email, status: "quoted", quotedAmount: "400.00" });

  await adminSignIn(page);
  await page.goto(`/admin/requests/${request.id}`);
  await expect(page.locator("#req-status")).toHaveValue("quoted");

  // The partner accepts while the team has the page open
  const db = sql();
  await db`update quote_requests set status = 'confirmed' where id = ${request.id}`;
  await db.end();

  await page.fill("#req-notes", "Driver: Jan");
  await page.getByRole("button", { name: a.common.save }).click();
  await expect(page.locator("#req-error")).toContainText("changed while you had it open");
  expect((await bookingRow(request.reference))?.status).toBe("confirmed");
});

test("the team can enter a phone booking for a partner, and it appears in their portal", async ({ page, context, browser }) => {
  await ownAddress(context);
  const email = newEmail("phone");
  const contactId = await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");

  await adminSignIn(page);
  await page.goto("/admin/requests/new");
  await page.selectOption("#nb-contactId", contactId);
  await page.fill("#nb-collection", "Eindhoven Airport");
  // The first box is the destination; each "Add stop" adds a stop, and "| minutes" after a stop's name is its waiting time
  const boxes = page.locator("input[name=destinations]");
  await boxes.first().fill("Amsterdam Zuid");
  await page.getByRole("button", { name: a.newBooking.addStop }).click();
  await boxes.nth(1).fill("Utrecht Centraal | 45");
  await page.getByRole("button", { name: a.newBooking.addStop }).click();
  await boxes.nth(2).fill("Breda");
  await page.fill("#nb-pickupAt", "2031-04-02T09:15");
  await page.selectOption("#nb-phoneCountry", "31");
  await page.fill("#nb-phone", "6 1234 5678");
  await page.selectOption("#nb-status", "confirmed");
  await page.getByRole("button", { name: a.newBooking.submit }).click();
  await expect(page).toHaveURL(/\/admin\/requests\/[0-9a-f-]{36}$/);
  await expect(page.getByText(a.events.createdByTeam)).toBeVisible();
  // The stop's wait is on the request, and the stop with no wait says nothing
  await expect(page.getByText(a.requestDetail.stopWait.replace("{minutes}", "45"))).toBeVisible();
  await expect(page.getByText(/^Waiting \d+ min$/)).toHaveCount(1);

  const partnerContext = await browser.newContext({ baseURL: ORIGIN, storageState: CONSENTED_STATE });
  await ownAddress(partnerContext);
  const partner = await partnerContext.newPage();
  await logIn(partner, email, PASSWORD);
  await partner.goto("/en/corporate-partner/account?tab=open");
  await expect(partner.getByText("Eindhoven Airport → Amsterdam Zuid")).toBeVisible();
  await expect(partner.getByText(p.statuses.confirmed, { exact: true })).toBeVisible();
  await partnerContext.close();
});

// ── Invoices (need document storage: set DOCUMENTS_DIR for the server and for this run) ─────────────────────

test("an invoice uploaded by the team is downloadable by its partner and nobody else", async ({ page, context, browser, request }) => {
  test.slow(); // many round trips between three browsers
  test.skip(!process.env.DOCUMENTS_DIR, "Set DOCUMENTS_DIR (as the server runs with it) to test invoices");
  await ownAddress(context);
  const email = newEmail("invoice");
  const contactId = await seedContact(email, PASSWORD, "Anouk Jansen", "Orion Holdings B.V.");
  const booking = await seedBooking({ contactId, email, status: "completed" });
  const dir = process.env.DOCUMENTS_DIR!;
  const before = await readdir(dir);

  await adminSignIn(page);
  await page.goto(`/admin/requests/${booking.id}`);
  await page.locator('input[type="file"]').setInputFiles({ name: "Invoice October.pdf", mimeType: "application/pdf", buffer: pdf });
  await expect(page.getByRole("button", { name: a.invoices.delete, exact: true })).toBeVisible();
  await expect(page.getByText(a.events.invoiceAdded.replace("{file}", "Invoice October.pdf"))).toBeVisible();

  const partnerContext = await browser.newContext({ baseURL: ORIGIN, storageState: CONSENTED_STATE });
  await ownAddress(partnerContext);
  const partner = await partnerContext.newPage();
  await logIn(partner, email, PASSWORD);
  await partner.goto(detail(booking.reference));
  const href = await partner.getByRole("link", { name: p.invoiceDownload }).getAttribute("href");
  expect(href).toMatch(/^\/api\/portal\/invoices\/[0-9a-f-]{36}$/);

  const owned = await partner.request.get(href!);
  expect(owned.status()).toBe(200);
  expect(owned.headers()["content-type"]).toBe("application/pdf");
  expect(owned.headers()["content-disposition"]).toContain("attachment");
  expect((await owned.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Another partner and a visitor with no sign-in get nothing
  const strangerContext = await browser.newContext({ baseURL: ORIGIN, storageState: CONSENTED_STATE });
  await ownAddress(strangerContext);
  const stranger = await strangerContext.newPage();
  const strangerEmail = newEmail("invoice-stranger");
  await seedContact(strangerEmail, PASSWORD);
  await logIn(stranger, strangerEmail, PASSWORD);
  expect((await stranger.request.get(href!)).status()).toBe(404);
  expect((await request.get(href!)).status()).toBe(401);

  // Deleting it takes the file away from the partner, and from the disk
  await page.reload();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: a.invoices.delete, exact: true }).click();
  await expect(page.getByText(a.invoices.none)).toBeVisible();
  expect((await partner.request.get(href!)).status()).toBe(404);
  expect(await readdir(dir)).toEqual(before);
  await partnerContext.close();
  await strangerContext.close();
});

test("the introduction form keeps its pills after an error, and no pill spills out of its card on a tablet or phone, in Dutch too", async ({ page, context }) => {
  await signedInPartner(page, context, "intro-pills");
  await page.goto("/en/corporate-partner/account/introduction");
  await page.locator("#c-contactMethod-whatsapp").check();
  await page.locator("#c-tripTime-morning").check();
  await submit(page, en.corporatePartner.submit);
  await expect(page.locator("#c-company-error")).toBeVisible();
  await expect(page.locator("#c-contactMethod-whatsapp")).toBeChecked();
  await expect(page.locator("#c-tripTime-morning")).toBeChecked();

  // Nothing may run past the edge of its own box: the longer Dutch labels at a tablet's narrow cards are the risk
  for (const path of ["/nl/zakelijke-partner/account/kennismaking"]) {
    for (const width of [390, 440, 768, 1024]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.locator("form section").first()).toBeVisible();
      // Text may not run past its pill or card; a long value inside a field scrolls within it, which is fine, but the field itself may not leave its card
      const spills = await page.evaluate(() => {
        const out: string[] = [];
        for (const el of document.querySelectorAll("form section, form fieldset label")) {
          if (el.scrollWidth > el.clientWidth + 1) out.push(`${el.tagName} ${el.textContent?.slice(0, 20)}`);
        }
        for (const el of document.querySelectorAll("form section :is(input, select, textarea, label)")) {
          if (el.getBoundingClientRect().right > el.closest("section")!.getBoundingClientRect().right + 1) out.push(`${el.tagName}#${el.id}`);
        }
        return out;
      });
      expect(spills, `${path} at ${width}px`).toEqual([]);
    }
  }
  // The new-booking page is the booking flow now: its bar fits the screen at the same widths, in Dutch
  for (const width of [390, 440, 768, 1024]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/nl/zakelijke-partner/account/nieuwe-boeking");
    await expect(page.locator("main").getByLabel(nl.booking.from, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth), `new booking at ${width}px`).toBeLessThanOrEqual(width);
  }
});
