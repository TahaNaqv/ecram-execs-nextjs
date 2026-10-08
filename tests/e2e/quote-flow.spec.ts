import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./helpers";

async function signIn(page: Page) {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login/);
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
}

test("the quote form validates input", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /request tailored quote/i }).click();
  await expect(page.locator("#q-name-error")).toHaveText("Please enter your name.");
  await expect(page.locator("#q-email-error")).toBeVisible();
  await expect(page.locator("#q-pickupAt-error")).toBeVisible();
});

test("a quote request flows from the website into the admin panel and can be managed and deleted", async ({ page }) => {
  const email = `client-${Date.now()}@e2e.ecramexecs.test`;

  // 1. Visitor submits the form
  await page.goto("/");
  await page.fill("#q-collection", "Schiphol Airport, Arrivals 2");
  await page.fill("#q-destination", "Hotel Des Indes, The Hague");
  await page.fill("#q-pickupAt", `${new Date().getFullYear() + 1}-03-14T08:30`);
  await page.selectOption("#q-service", "Airport transfer");
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
  await expect(page.getByText("Status: new → quoted").filter({ visible: true })).toBeVisible();
  await expect(page.getByText("€ 185,50").filter({ visible: true })).toBeVisible();

  // 4. Invalid amount is rejected
  await page.getByLabel("Quoted amount (EUR)").fill("abc");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(/Enter an amount/).filter({ visible: true })).toBeVisible();

  // 5. GDPR deletion
  await page.getByRole("button", { name: /delete this request/i }).click();
  await page.getByRole("button", { name: /yes, delete permanently/i }).click();
  await expect(page.getByRole("heading", { name: "Quote requests" })).toBeVisible();
  await page.goto(`/admin?q=${reference}`);
  await expect(page.getByText("No requests match these filters.").first()).toBeAttached();
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
