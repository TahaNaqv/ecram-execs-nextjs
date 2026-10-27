import { randomUUID } from "node:crypto";
import { expect, test, type Page, type PlaywrightWorkerArgs } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import { seedBooking, sql } from "./corporate-helpers";
import { fakeAnthropic } from "./fake-anthropic";
import { fillAdminLogin } from "./helpers";

/**
 * The chats with the concierge are kept for 90 days (lib/concierge/store.ts), and the team reads them in the admin panel.
 * The model is played by a stand-in, so these only run when asked to (see the top of concierge-guide.spec.ts):
 *
 *   ANTHROPIC_API_KEY=test ANTHROPIC_API_URL=http://127.0.0.1:4598/v1/messages E2E_FAKE_ANTHROPIC=4598 \
 *   npx playwright test concierge-chats
 */
const PORT = Number(process.env.E2E_FAKE_ANTHROPIC ?? 0);
test.skip(!PORT, "Set E2E_FAKE_ANTHROPIC (and the Anthropic variables, see concierge-guide.spec.ts) to run the saved-chat tests");
test.describe.configure({ mode: "serial" });

const model = fakeAnthropic(PORT);
test.beforeAll(() => model.start());
test.beforeEach(() => model.reset());

const created: string[] = [];
const newSession = () => {
  const id = randomUUID().replaceAll("-", "");
  created.push(id);
  return id;
};
const octet = () => Math.floor(Math.random() * 250);
const newAddress = () => `10.${octet()}.${octet()}.${octet()}`;
test.afterAll(async () => {
  model.stop();
  const db = sql();
  await db`delete from concierge_conversations where session_id = any(${created}) or ip_hash in ('purge-test', 'purge-booking')`;
  await db.end();
});

async function turn(playwright: PlaywrightWorkerArgs["playwright"], baseURL: string | undefined, session: string | undefined, message: string, o: { ip: string; locale?: string; draft?: object }) {
  const api = await playwright.request.newContext({ baseURL, extraHTTPHeaders: { "x-forwarded-for": o.ip } });
  try {
    const res = await api.post("/api/concierge", { data: { message, locale: o.locale ?? "en", session, draft: o.draft } });
    return { status: res.status(), json: await res.json() };
  } finally {
    await api.dispose();
  }
}

/** The chat saved under a session id, with its messages, once the (after-the-reply) save has happened. */
async function saved(session: string, messages = 2) {
  const db = sql();
  try {
    let chat: Record<string, unknown> | undefined;
    await expect
      .poll(async () => {
        // The row and its message count in one statement, so they are from the same moment
        [chat] = await db`select c.*, (select count(*)::int from concierge_messages m where m.conversation_id = c.id) as saved from concierge_conversations c where c.session_id = ${session}`;
        return chat ? Number(chat.saved) : 0;
      })
      .toBeGreaterThanOrEqual(messages);
    const rows = await db`select position, role, content, meta from concierge_messages where conversation_id = ${chat!.id as string} order by position`;
    return { chat: chat!, messages: rows as unknown as { position: number; role: string; content: string; meta: Record<string, unknown> | null }[] };
  } finally {
    await db.end();
  }
}
/** Gives the save time to happen, then says whether anything is stored under a session id. */
async function notSaved(session: string) {
  await new Promise((r) => setTimeout(r, 1200));
  const db = sql();
  const rows = await db`select 1 from concierge_conversations where session_id = ${session}`;
  await db.end();
  return rows.length === 0;
}

test("a chat is saved turn by turn, in order, with its language and what the assistant had recorded", async ({ playwright, baseURL }) => {
  const ip = newAddress();
  const session = newSession();
  model.script.push({ content: [model.say("Good day. Where would you like to go?")] });
  expect((await turn(playwright, baseURL, session, "I would like to book a ride.", { ip, locale: "nl" })).status).toBe(200);
  let { chat, messages } = await saved(session);
  expect(chat).toMatchObject({ locale: "nl", message_count: 2, draft: null, request_id: null });
  expect(chat.ip_hash).toMatch(/^[a-f0-9]{64}$/);
  expect(messages.map((m) => [m.position, m.role, m.content])).toEqual([
    [0, "visitor", "I would like to book a ride."],
    [1, "concierge", "Good day. Where would you like to go?"],
  ]);

  // The next turn is added to the same chat, and the booking noted in it is kept with it
  model.script.push({ content: [model.toolUse({ from: "Schiphol Airport", passengers: 2 })] }, { content: [model.say("Noted.")] });
  await turn(playwright, baseURL, session, "Schiphol, two of us", { ip, locale: "nl" });
  ({ chat, messages } = await saved(session, 4));
  expect(chat).toMatchObject({ message_count: 4, draft: { from: "Schiphol Airport", passengers: 2 } });
  expect(messages.map((m) => [m.position, m.role])).toEqual([[0, "visitor"], [1, "concierge"], [2, "visitor"], [3, "concierge"]]);
  expect(messages[3].content).toBe("Noted.");
});

test("nothing is saved without a session id, with a made-up one, or when the visitor is turned away", async ({ playwright, baseURL }) => {
  const ip = newAddress();
  const db = sql();
  const before = (await db`select count(*)::int as n from concierge_conversations`)[0].n as number;
  await turn(playwright, baseURL, undefined, "no session", { ip });
  await turn(playwright, baseURL, "not-a-session", "made up", { ip });
  await new Promise((r) => setTimeout(r, 1200));
  expect((await db`select count(*)::int as n from concierge_conversations`)[0].n).toBe(before);

  // A chat that has used up its messages is refused, and the refusal is not saved
  const session = newSession();
  for (let i = 0; i < 20; i++) await turn(playwright, baseURL, session, `message ${i}`, { ip });
  await saved(session, 40);
  const refused = await turn(playwright, baseURL, session, "one too many", { ip });
  expect(refused.status).toBe(429);
  await new Promise((r) => setTimeout(r, 1200));
  const [chat] = await db`select message_count from concierge_conversations where session_id = ${session}`;
  expect(chat.message_count).toBe(40);
  expect(await db`select 1 from concierge_messages m join concierge_conversations c on c.id = m.conversation_id where c.session_id = ${session} and m.content = 'one too many'`).toHaveLength(0);
  await db.end();
});

test("what is saved is cleaned: control and direction-changing characters out, markup kept as plain text", async ({ playwright, baseURL }) => {
  const ip = newAddress();
  const session = newSession();
  model.script.push(
    { content: [model.toolUse({ from: "Sch\u0000iphol ‮Airport", name: "Jan‮ de\u0000 Vries", notes: "<b>bold</b>" })] },
    { content: [model.say("ok\u0000 ‮done <script>alert(1)</script>")] },
  );
  await turn(playwright, baseURL, session, "hi\u0000 there ‮ <script>alert(1)</script>", { ip });
  const { chat, messages } = await saved(session);
  // The save went through (a NUL anywhere would have failed it), and none of the characters were kept
  expect(messages[0].content).toBe("hi there  <script>alert(1)</script>");
  expect(messages[1].content).toBe("ok done <script>alert(1)</script>");
  expect(chat.draft).toEqual({ from: "Schiphol Airport", name: "Jan de Vries", notes: "<b>bold</b>" });
});

test("how an answer came about is noted with it: a stored answer, reasoning taken out, cars shown, a complete booking, the hand-over", async ({ playwright, baseURL }) => {
  const ip = newAddress();
  const note = async (setup: () => void, message: string) => {
    model.reset();
    setup();
    const session = newSession();
    await turn(playwright, baseURL, session, message, { ip });
    return (await saved(session)).messages[1];
  };

  // The model is down: the matching stored answer, marked as one
  const down = await note(() => model.script.push({ status: 503 }), "How do I make a booking?");
  expect(down.content).toBe(en.conciergeSection.faq14A);
  expect(down.meta).toMatchObject({ fallback: true, handoff: false });

  // Reasoning the model wrote to itself was taken out before the visitor saw it, and what the visitor saw is what is saved
  const thinking = await note(() => model.script.push({ content: [model.say("The visitor wants a car. I will not call the tool. Certainly, where to?")] }), "a car");
  expect(thinking.content).toBe("Certainly, where to?");
  expect(thinking.meta).toMatchObject({ filtered: true });

  const cars = await note(() => model.script.push({ content: [{ type: "tool_use", id: "t", name: "show_cars", input: {} }] }, { content: [model.say("Here are our cars.")] }), "which cars?");
  expect(cars.meta).toMatchObject({ cars: true });

  const ready = await note(
    () =>
      model.script.push(
        { content: [model.toolUse({ from: "Schiphol Airport", to: "Hotel Des Indes, The Hague", at: `${new Date(Date.now() + 36 * 3600_000).toISOString().slice(0, 10)}T09:00`, passengers: 1, bags: 0, name: "Sam Carter", email: "sam@example.com", phone: "+31 6 1234 5678" })] },
        { content: [model.say("Please check the card.")] },
      ),
    "everything",
  );
  expect(ready.meta).toMatchObject({ ready: true });

  const handoff = await note(() => model.script.push({ content: [model.say("Our team will help on WhatsApp. [HANDOFF_WHATSAPP]")] }), "cancel my booking");
  expect(handoff.content).toBe("Our team will help on WhatsApp.");
  expect(handoff.meta).toMatchObject({ handoff: true });
});

test("a chat is not kept past 400 messages, and its count stops there", async ({ playwright, baseURL }) => {
  const ip = newAddress();
  const session = newSession();
  const db = sql();
  const [chat] = await db`insert into concierge_conversations (session_id, message_count) values (${session}, 400) returning id`;
  await turn(playwright, baseURL, session, "one more", { ip });
  await expect.poll(async () => (await db`select message_count from concierge_conversations where id = ${chat.id}`)[0].message_count).toBe(402);
  await turn(playwright, baseURL, session, "and another", { ip });
  await new Promise((r) => setTimeout(r, 1200));
  expect((await db`select message_count from concierge_conversations where id = ${chat.id}`)[0].message_count).toBe(402);
  expect(await db`select 1 from concierge_messages where conversation_id = ${chat.id}`).toHaveLength(0);
  await db.end();
});

test("one address can start only so many chats a day; chats already started carry on", async ({ playwright, baseURL }) => {
  const ip = newAddress();
  const first = newSession();
  await turn(playwright, baseURL, first, "hello", { ip });
  const { chat } = await saved(first);
  // Ninety-nine more from the same address in the last day: the hundredth is the limit
  const db = sql();
  await db`insert into concierge_conversations (session_id, ip_hash) select md5(random()::text || g::text), ${chat.ip_hash as string} from generate_series(1, 99) g`;
  const second = newSession();
  await turn(playwright, baseURL, second, "a new chat", { ip });
  expect(await notSaved(second)).toBe(true);
  // The chat that was already started is still kept
  await turn(playwright, baseURL, first, "still here", { ip });
  await saved(first, 4);
  // ...and the visitor was answered all along
  expect((await turn(playwright, baseURL, second, "answered?", { ip })).status).toBe(200);
  await db`delete from concierge_conversations where ip_hash = ${chat.ip_hash as string}`;
  await db.end();
});

test("expired chats are cleared, a few at a time, when a new chat starts and not otherwise", async ({ playwright, baseURL }) => {
  const db = sql();
  // A chat that already exists, started before there is anything to clear
  const ip = newAddress();
  const existing = newSession();
  await turn(playwright, baseURL, existing, "first", { ip });
  await saved(existing);

  await db`insert into concierge_conversations (session_id, ip_hash, started_at, last_message_at) select md5('old' || g::text), 'purge-test', now() - interval '92 days', now() - interval '91 days' from generate_series(1, 25) g`;
  const [recent] = await db`insert into concierge_conversations (session_id, ip_hash, started_at, last_message_at) values (md5('recent'), 'purge-test', now() - interval '90 days', now() - interval '89 days') returning id`;
  const left = async () => Number((await db`select count(*)::int as n from concierge_conversations where ip_hash = 'purge-test' and last_message_at < now() - interval '90 days'`)[0].n);
  expect(await left()).toBe(25);

  // Another message in a chat that exists clears nothing
  await turn(playwright, baseURL, existing, "second", { ip });
  await saved(existing, 4);
  expect(await left()).toBe(25);

  // A new chat clears a batch of twenty, and the one inside the period stays
  const fresh = newSession();
  await turn(playwright, baseURL, fresh, "a new chat", { ip: newAddress() });
  await saved(fresh);
  await expect.poll(left).toBe(5);
  expect(await db`select 1 from concierge_conversations where id = ${recent.id}`).toHaveLength(1);
  await db`delete from concierge_conversations where ip_hash = 'purge-test'`;
  await db.end();
});

test("as a new chat starts, expired chats go, but the chat of a live booking stays for a year", async ({ playwright, baseURL }) => {
  const db = sql();
  const live = await seedBooking({ contactId: null, email: `chat-live-${Date.now()}@e2e.ecramexecs.test`, status: "confirmed" });
  const quoted = await seedBooking({ contactId: null, email: `chat-quoted-${Date.now()}@e2e.ecramexecs.test`, status: "quoted" });
  const seed = async (ago: string, requestId: string | null) =>
    (await db`insert into concierge_conversations (session_id, ip_hash, request_id, started_at, last_message_at) values (md5(random()::text), 'purge-booking', ${requestId}, now() - ${ago}::interval, now() - ${ago}::interval) returning id`)[0].id as string;
  const liveKept = await seed("120 days", live.id);
  const liveExpired = await seed("400 days", live.id);
  const quotedGone = await seed("100 days", quoted.id);
  const loose = await seed("95 days", null);
  const there = async (id: string) => (await db`select 1 from concierge_conversations where id = ${id}`).length === 1;

  const session = newSession();
  await turn(playwright, baseURL, session, "a new chat", { ip: newAddress() });
  await saved(session);
  await expect.poll(() => there(liveExpired)).toBe(false);
  expect(await there(quotedGone)).toBe(false);
  expect(await there(loose)).toBe(false);
  expect(await there(liveKept)).toBe(true);
  await db`delete from concierge_conversations where ip_hash = 'purge-booking'`;
  await db.end();
});

test("two messages of one chat at the same moment are both kept, each in its own place", async ({ playwright, baseURL }) => {
  const ip = newAddress();
  const session = newSession();
  await Promise.all([turn(playwright, baseURL, session, "first of two", { ip }), turn(playwright, baseURL, session, "second of two", { ip })]);
  const { chat, messages } = await saved(session, 4);
  expect(chat.message_count).toBe(4);
  expect(messages.map((m) => m.position)).toEqual([0, 1, 2, 3]);
  expect(messages.filter((m) => m.role === "visitor").map((m) => m.content).sort()).toEqual(["first of two", "second of two"]);
});

test("the chat says, before anything is typed, that it is saved for 90 days and where to read why", async ({ page }) => {
  await page.goto("/en");
  const note = page.getByText(en.conciergeSection.storedNote.replace("{days}", "90"));
  await expect(note).toBeVisible();
  await expect(note.getByRole("link", { name: en.booking.privacyLink })).toHaveAttribute("href", "/en/privacy");
  await page.goto("/nl");
  await expect(page.getByText(nl.conciergeSection.storedNote.replace("{days}", "90"))).toBeVisible();
  // And the policy no longer says the opposite
  await page.goto("/en/privacy");
  await expect(page.getByText("We do not store the conversation")).toHaveCount(0);
  await expect(page.getByText("We save the conversation for 90 days")).toBeVisible();
  await expect(page.getByText("Conversations with the chat concierge are kept for 90 days after the last message, or for one year if they led to a confirmed booking.")).toBeVisible();
  await expect(page.getByText("or for one year if the chat led to a booking that we have confirmed")).toBeVisible();
});

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: en.admin.dashboard.title })).toBeVisible();
}

test("the team reads the chats in the admin panel: the list, the transcript as plain text, the booking noted, the request it led to; and can delete one", async ({ page, playwright, baseURL }) => {
  test.slow();
  // Signed out, the pages lead to the sign-in
  await page.goto("/admin/chats");
  await expect(page).toHaveURL(/\/admin\/login/);

  const ip = newAddress();
  const session = newSession();
  model.script.push(
    { content: [model.toolUse({ from: "Schiphol Airport", passengers: 2, name: "Jan de Vries" })] },
    { content: [model.say("Noted. <script>alert(1)</script>")] },
  );
  await turn(playwright, baseURL, session, "I need a car <script>alert(1)</script>", { ip });
  const { chat } = await saved(session);
  const booking = await seedBooking({ contactId: null, email: `chat-${Date.now()}@e2e.ecramexecs.test`, status: "new" });
  const db = sql();
  await db`update concierge_conversations set request_id = ${booking.id} where id = ${chat.id as string}`;

  await signIn(page);
  await page.getByRole("navigation", { name: en.admin.nav.sectionsLabel }).getByRole("link", { name: new RegExp(`^${en.admin.nav.chats}`) }).click();
  await expect(page).toHaveURL(/\/admin\/chats$/);
  await expect(page.getByRole("heading", { name: en.admin.chats.title })).toBeVisible();
  const row = page.locator(`[data-chat="${chat.id}"]`);
  await expect(row).toContainText("I need a car <script>alert(1)</script>");
  await expect(row).toContainText(en.admin.chats.bookingSent.replace("{reference}", booking.reference));

  // The transcript, the booking the assistant noted (its words, labelled) and the request
  await row.getByRole("link").click();
  await expect(page.getByRole("heading", { name: en.admin.chats.detailTitle, exact: true })).toBeVisible();
  await expect(page.getByText("Noted. <script>alert(1)</script>")).toBeVisible();
  expect(await page.locator("script", { hasText: "alert(1)" }).count()).toBe(0);
  await expect(page.locator('[data-role="visitor"]')).toHaveCount(1);
  await expect(page.locator('[data-role="concierge"]')).toHaveCount(1);
  await expect(page.getByText(en.admin.chats.draftFields.from, { exact: true })).toBeVisible();
  await expect(page.getByText("Schiphol Airport", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: new RegExp(booking.reference) })).toHaveAttribute("href", `/admin/requests/${booking.id}`);

  // How long this chat is kept: 90 days, a year once its booking is confirmed
  await page.goto(`/admin/chats/${chat.id}`);
  await expect(page.getByText(en.admin.chats.keptNote.replace("{days}", "90"))).toBeVisible();
  await db`update quote_requests set status = 'confirmed' where id = ${booking.id}`;
  await page.reload();
  await expect(page.getByText(en.admin.chats.keptNoteBooking.replace("{days}", "365"))).toBeVisible();

  // From the request, the way back to its chat
  await page.goto(`/admin/requests/${booking.id}`);
  await expect(page.getByRole("main").getByRole("link", { name: en.admin.chats.chatLink, exact: true })).toHaveAttribute("href", `/admin/chats/${chat.id}`);

  // Delete: after a confirmation, the chat and its messages are gone
  await page.goto(`/admin/chats/${chat.id}`);
  await page.getByRole("button", { name: new RegExp(`Delete this ${en.admin.chats.deleteNoun}`) }).click();
  await page.getByRole("button", { name: en.admin.common.deleteConfirm }).click();
  await expect(page).toHaveURL(/\/admin\/chats$/);
  expect(await db`select 1 from concierge_conversations where id = ${chat.id as string}`).toHaveLength(0);
  expect(await db`select 1 from concierge_messages where conversation_id = ${chat.id as string}`).toHaveLength(0);
  await expect(page.locator(`[data-chat="${chat.id}"]`)).toHaveCount(0);
  await db.end();
});

test("the chats read in Dutch for a Dutch admin", async ({ page, playwright, baseURL }) => {
  test.slow();
  const session = newSession();
  await turn(playwright, baseURL, session, "Goedendag", { ip: newAddress(), locale: "nl" });
  const { chat } = await saved(session);
  await signIn(page);
  await page.getByRole("form", { name: en.admin.common.language }).getByRole("button", { name: "nl" }).click();
  try {
    await expect(page.getByRole("form", { name: nl.admin.common.language }).getByRole("button", { name: "nl" })).toBeDisabled();
    await page.goto("/admin/chats");
    await expect(page.getByRole("heading", { name: nl.admin.chats.title })).toBeVisible();
    await expect(page.getByRole("link", { name: new RegExp(`^${nl.admin.nav.chats}`) })).toBeVisible();
    await page.goto(`/admin/chats/${chat.id}`);
    await expect(page.getByRole("heading", { name: nl.admin.chats.detailTitle, exact: true })).toBeVisible();
    await expect(page.getByText(nl.admin.chats.visitor, { exact: true })).toBeVisible();
  } finally {
    await page.getByRole("form", { name: nl.admin.common.language }).getByRole("button", { name: "en" }).click();
    await expect(page.getByRole("heading", { name: en.admin.chats.detailTitle, exact: true })).toBeVisible();
  }
});
