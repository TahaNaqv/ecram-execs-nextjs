import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./helpers";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";

async function signIn(page: Page) {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
}

test("the bespoke form validates input", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: en.bespokeSection.submit }).click();
  await expect(page.locator("#b-name-error")).toHaveText(en.forms.nameRequired);
  await expect(page.locator("#b-entity-error")).toHaveText(en.forms.entityRequired);
  await expect(page.locator("#b-itinerary-error")).toHaveText(en.forms.itineraryRequired);
  await expect(page.locator("#b-vehicleClass-error")).toHaveText(en.forms.vehicleClassRequired);
  await expect(page.locator("#b-contactPreference-error")).toHaveText(en.forms.contactPreferenceRequired);
});

test("a bespoke inquiry reaches the admin panel with its own details and no pick-up time", async ({ page }) => {
  const email = `bespoke-${Date.now()}@e2e.ecramexecs.test`;

  await page.goto("/en");
  await page.fill("#b-name", "Marieke van Dijk");
  await page.fill("#b-entity", "Orion Holdings B.V.");
  await page.fill("#b-email", email);
  await page.fill("#b-phone", "+31 6 1234 5678");
  await page.fill("#b-passengers", "14");
  await page.selectOption("#b-vehicleClass", "mixed_fleet");
  await page.selectOption("#b-contactPreference", "whatsapp");
  await page.fill("#b-itinerary", "Day 1 Amsterdam, day 2 Rotterdam and The Hague. Protocol escort at Schiphol.");
  await page.getByRole("button", { name: en.bespokeSection.submit }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("Thank you, Marieke");
  const reference = (await status.innerText()).match(/EE-[A-Z0-9]{6}/)![0];

  await signIn(page);
  await page.getByPlaceholder(/search/i).fill(reference);
  await page.getByRole("button", { name: "Search" }).click();
  const row = page.locator("table tr").filter({ hasText: "Marieke van Dijk" });
  await expect(row).toContainText(en.services.bespoke);
  await row.getByRole("link", { name: /Marieke van Dijk/ }).click();

  await expect(page).toHaveURL(/\/admin\/requests\//);
  const visible = (text: string) => page.getByText(text).filter({ visible: true }).first();
  await expect(visible("Orion Holdings B.V.")).toBeVisible();
  await expect(visible(en.bespokeSection.vehicleClasses.mixed_fleet)).toBeVisible();
  await expect(visible(en.bespokeSection.contactOptions.whatsapp)).toBeVisible();
  await expect(visible("Protocol escort at Schiphol")).toBeVisible();

  // Clean up (GDPR deletion path, as in the quote flow)
  await page.getByRole("button", { name: /delete this request/i }).click();
  await page.getByRole("button", { name: /yes, delete permanently/i }).click();
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
});

test("the database refuses a non-bespoke request without a journey", async () => {
  // The check constraint is the safety net behind the form's own validation: a standard service
  // must keep its pick-up details even though the columns are now nullable for bespoke requests.
  const { default: postgres } = await import("postgres");
  // The test process is not Next, so it does not load .env.local itself (the disposable database).
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // CI provides DATABASE_URL directly
  }
  const sql = postgres(process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL!, { max: 1 });
  try {
    await expect(
      sql`insert into quote_requests (reference, service, name, email, phone)
          values (${`EE-T${Date.now() % 100000}`}, 'hourly', 'T', 't@e2e.test', '+31600000000')`,
    ).rejects.toThrow(/quote_requests_journey_required/);
  } finally {
    await sql.end();
  }
});

test("the Dutch bespoke form is fully translated", async ({ page }) => {
  await page.goto("/nl");
  await expect(page.getByRole("button", { name: nl.bespokeSection.submit })).toBeVisible();
  await expect(page.locator("#bespoke")).not.toContainText(en.bespokeSection.headingBefore);
});
