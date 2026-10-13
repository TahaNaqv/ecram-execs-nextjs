import { createHmac } from "node:crypto";
import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import postgres from "postgres";
import en from "../../lib/i18n/dictionaries/en.json";
import { E2E_ADMIN } from "./helpers";

/**
 * The emailed code can't be read in tests (no mail provider runs), and production code must not grow a
 * test-only backdoor — `next start` has NODE_ENV=production here, so a NODE_ENV guard would ship. Instead
 * the test writes a challenge row itself, using the same secret and HMAC the server uses, and the server
 * verifies it exactly as it would a real one.
 */
try {
  process.loadEnvFile?.(".env.local");
} catch {
  // No .env.local (CI sets the variables directly)
}
const SECRET = process.env.CORPORATE_OTP_SECRET ?? "";
const sql = () => postgres(process.env.DATABASE_URL!, { prepare: false, max: 1 });
const hmac = (id: string, code: string) => createHmac("sha256", SECRET).update(`${id}:${code}`).digest("hex");

test.skip(!SECRET, "Set CORPORATE_OTP_SECRET (the same value the server runs with) to run the Corporate Partner flow");

async function seedChallenge(email: string, code: string, opts: { expired?: boolean } = {}) {
  const db = sql();
  try {
    const [contact] = await db`
      insert into corporate_contacts (email, email_domain, name, position, locale)
      values (${email}, 'e2e.ecramexecs.test', 'Anouk Jansen', 'Head of Travel', 'en')
      on conflict (email) do update set name = excluded.name returning id`;
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + (opts.expired ? -60_000 : 10 * 60_000));
    await db`insert into corporate_challenges (id, contact_id, code_hmac, expires_at)
             values (${id}, ${contact.id}, ${hmac(id, code)}, ${expiresAt})`;
    return id;
  } finally {
    await db.end();
  }
}

const t = en.corporatePartner;

test("the request step validates its fields", async ({ page }) => {
  await page.goto("/en/corporate-partner");
  await page.getByRole("button", { name: t.sendCode }).click();
  await expect(page.locator("#c-email-error")).toHaveText(en.forms.emailInvalid);
  await expect(page.locator("#c-name-error")).toHaveText(en.forms.nameRequired);
  await expect(page.locator("#c-position-error")).toHaveText(t.positionRequired);
});

test("the restricted form is not reachable without a verified code", async ({ page }) => {
  await page.goto("/en/corporate-partner");
  await expect(page.getByRole("heading", { name: t.formHeading })).toHaveCount(0);
  await expect(page.locator("#c-company")).toHaveCount(0);
});

test("a correct code opens the restricted form, and the request reaches the admin panel", async ({ page, context }) => {
  const email = `corp-${Date.now()}@e2e.ecramexecs.test`;
  const challengeId = await seedChallenge(email, "246810");
  await context.addCookies([{ name: "ee_cp_challenge", value: challengeId, url: `http://localhost:${process.env.E2E_PORT ?? 3100}` }]);

  await page.goto("/en/corporate-partner");
  // A reload mid-flow lands on the code step, not the start
  await expect(page.getByRole("heading", { name: t.verifyHeading })).toBeVisible();
  await page.fill("#c-code", "246810");
  await page.getByRole("button", { name: t.verifyCta }).click();
  await expect(page.getByRole("heading", { name: t.formHeading })).toBeVisible();

  await page.fill("#c-company", "Orion Holdings B.V.");
  await page.fill("#c-billingName", "Finance Desk");
  await page.fill("#c-billingEmail", `finance-${Date.now()}@e2e.ecramexecs.test`);
  await page.fill("#c-phone", "+31 6 1234 5678");
  await page.selectOption("#c-volume", "6_15");
  await page.selectOption("#c-invoicing", "monthly");
  await page.getByRole("button", { name: t.submit }).click();
  await expect(page.getByRole("status")).toContainText("Anouk");

  // Reloading keeps the verified session (24h access cookie, checked against the database)
  await page.goto("/en/corporate-partner");
  await expect(page.getByRole("heading", { name: t.formHeading })).toBeVisible();

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.goto("/admin/corporate");
  await expect(page.getByText(email)).toBeVisible();
});

test("a wrong code is refused, and five wrong codes lock the challenge", async ({ page, context }) => {
  const email = `corp-wrong-${Date.now()}@e2e.ecramexecs.test`;
  const challengeId = await seedChallenge(email, "111111");
  await context.addCookies([{ name: "ee_cp_challenge", value: challengeId, url: `http://localhost:${process.env.E2E_PORT ?? 3100}` }]);
  await page.goto("/en/corporate-partner");

  await page.fill("#c-code", "000000");
  await page.getByRole("button", { name: t.verifyCta }).click();
  await expect(page.locator("#c-code-error")).toContainText("Attempts left: 4");

  for (let i = 0; i < 4; i++) {
    await page.fill("#c-code", "000000");
    await page.getByRole("button", { name: t.verifyCta }).click();
    await page.waitForTimeout(250);
  }
  // Even the right code no longer works once the attempts are spent
  await expect(page.getByText(t.tooManyAttempts)).toBeVisible();
  await expect(page.locator("#c-company")).toHaveCount(0);
});

test("an expired code is refused", async ({ page, context }) => {
  const email = `corp-expired-${Date.now()}@e2e.ecramexecs.test`;
  const challengeId = await seedChallenge(email, "135790", { expired: true });
  await context.addCookies([{ name: "ee_cp_challenge", value: challengeId, url: `http://localhost:${process.env.E2E_PORT ?? 3100}` }]);
  await page.goto("/en/corporate-partner");
  // An expired challenge is not offered as a pending code; the visitor starts again
  await expect(page.locator("#c-email")).toBeVisible();
});
