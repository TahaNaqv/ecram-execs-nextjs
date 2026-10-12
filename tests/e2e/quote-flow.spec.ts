import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./helpers";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";

async function signIn(page: Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
}

test("the quote form validates input", async ({ page }) => {
  await page.goto("/en");
  await page.getByRole("button", { name: /request tailored quote/i }).click();
  await expect(page.locator("#q-name-error")).toHaveText("Please enter your name.");
  await expect(page.locator("#q-email-error")).toBeVisible();
  await expect(page.locator("#q-pickupAt-error")).toBeVisible();
});

test("a quote request flows from the website into the admin panel and can be managed and deleted", async ({ page }) => {
  const email = `client-${Date.now()}@e2e.ecramexecs.test`;

  // 1. Visitor submits the form
  await page.goto("/en");
  await page.fill("#q-collection", "Schiphol Airport, Arrivals 2");
  await page.fill("#q-destination", "Hotel Des Indes, The Hague");
  await page.fill("#q-pickupAt", `${new Date().getFullYear() + 1}-03-14T08:30`);
  await page.selectOption("#q-service", { value: "airport_transfer" });
  await page.selectOption("#q-passengers", "2");
  await page.fill("#q-name", "Jan de Vries");
  await page.fill("#q-email", email);
  await page.fill("#q-phone", "+31 6 1234 5678");
  await page.fill("#q-notes", "Flight KL1234");
  await page.getByRole("button", { name: /request tailored quote/i }).click();
  const status = page.getByRole("status");
  await expect(status).toContainText("Thank you, Jan");
  const reference = (await status.innerText()).match(/EE-[A-Z0-9]{6}/)![0];

  // 2. Admin finds it
  await signIn(page);
  await page.getByPlaceholder(/search/i).fill(reference);
  await page.getByRole("button", { name: "Search" }).click();
  await page.locator("table").getByRole("link", { name: /Jan de Vries/ }).click();
  await expect(page).toHaveURL(/\/admin\/requests\//);
  // Next.js keeps the previous page mounted (hidden), so only match visible text
  await expect(page.getByText(reference).filter({ visible: true })).toBeVisible();
  await expect(page.getByText("Flight KL1234").filter({ visible: true })).toBeVisible();

  // 3. Admin quotes it
  await page.getByLabel("Status", { exact: true }).selectOption("quoted");
  await page.getByLabel("Quoted amount (EUR)").fill("185,50");
  await page.getByRole("button", { name: "Save changes" }).click();
  // History is stored as keys + params and rendered with the reader's locale formatting, so the
  // amount now appears both in the activity log and in the summary. Assert the whole log line,
  // then that the amount is on the page at all (first match, since it is in two places).
  await expect(page.getByText("Status: new → quoted · Quote: — → € 185,50").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("€ 185,50").filter({ visible: true }).first()).toBeVisible();

  // 4. Invalid amount is rejected
  await page.getByLabel("Quoted amount (EUR)").fill("abc");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Enter an amount/).filter({ visible: true })).toBeVisible();

  // 5. GDPR deletion
  await page.getByRole("button", { name: /delete this request/i }).click();
  await page.getByRole("button", { name: /yes, delete permanently/i }).click();
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
  await page.goto(`/admin?q=${reference}`);
  await expect(page.getByText("No requests match these filters").first()).toBeAttached();
});

test("the admin panel rejects wrong passwords and signs out", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill("definitely-wrong");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form [role=alert]")).toHaveText("Incorrect email or password.");

  await signIn(page);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
});


test("a Dutch visitor's request stores a language-independent service key", async ({ page }) => {
  // The point of storing `airport_transfer` rather than a label: a visitor picks the service in
  // Dutch, and the team reads it in whichever language their panel is set to. If this ever
  // regresses, the admin shows a Dutch label (or a raw key) to an English reader.
  const email = `client-nl-${Date.now()}@e2e.ecramexecs.test`;

  await page.goto("/nl");
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await page.fill("#q-collection", "Schiphol, Aankomsthal 2");
  await page.fill("#q-destination", "Hotel Des Indes, Den Haag");
  await page.fill("#q-pickupAt", `${new Date().getFullYear() + 1}-04-02T09:15`);
  // Selected by its Dutch label — the value written to the database is the key.
  await page.selectOption("#q-service", { label: nl.services.airport_transfer });
  await page.selectOption("#q-passengers", "3");
  await page.fill("#q-name", "Sanne Bakker");
  await page.fill("#q-email", email);
  await page.fill("#q-phone", "+31 6 9876 5432");
  await page.getByRole("button", { name: nl.quoteForm.submit }).click();

  const status = page.getByRole("status");
  await expect(status).toContainText("Sanne");
  await expect(status).toContainText(nl.quoteForm.successNote);
  const reference = (await status.innerText()).match(/EE-[A-Z0-9]{6}/)![0];

  // The admin is English, so the same request must read back as the English label.
  await page.goto("/admin/login");
  await page.getByLabel(en.admin.common.email).fill(E2E_ADMIN.email);
  await page.getByLabel(en.admin.login.password).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: en.admin.login.signIn }).click();
  await page.getByPlaceholder(en.admin.requests.searchPlaceholder).fill(reference);
  await page.getByRole("button", { name: en.admin.common.search }).click();

  const row = page.locator("table tr").filter({ hasText: "Sanne Bakker" });
  await expect(row).toContainText(en.services.airport_transfer);
  await expect(row).not.toContainText(nl.services.airport_transfer);
});

test("an admin can switch the panel language and it sticks", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel(en.admin.common.email).fill(E2E_ADMIN.email);
  await page.getByLabel(en.admin.login.password).fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: en.admin.login.signIn }).click();
  await expect(page.getByRole("heading", { name: en.admin.requests.title })).toBeVisible();

  const switcher = page.getByRole("form", { name: en.admin.common.language });
  await switcher.getByRole("button", { name: "nl" }).click();
  await expect(page.getByRole("heading", { name: nl.admin.requests.title })).toBeVisible();

  // The preference is on the account, not the URL, so it survives navigating elsewhere.
  await page.goto("/admin/drivers");
  await expect(page.getByRole("heading", { name: nl.admin.drivers.title })).toBeVisible();

  // Put it back so the rest of the suite sees an English panel.
  await page.goto("/admin");
  await page.getByRole("form", { name: nl.admin.common.language }).getByRole("button", { name: "en" }).click();
  await expect(page.getByRole("heading", { name: en.admin.requests.title })).toBeVisible();
});
