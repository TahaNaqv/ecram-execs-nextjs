import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./helpers";

// These plates are real RDW records (the check runs against the live register):
// a black, electric 2024 Mercedes-Benz EQB taxi that meets the criteria, and a Toyota Prius that doesn't.
const QUALIFYING_PLATE = "GHL-93-X";
const FAILING_PLATE = "13-TFN-3";

async function fillApplication(page: Page, name: string, plate: string) {
  await page.getByLabel("Licence plate").fill(plate);
  await page.getByLabel("Full name").fill(name);
  await page.getByLabel("Email").fill(`partner-${Date.now()}@e2e.ecramexecs.test`);
  await page.getByLabel("Phone").fill("+31 6 0000 0002");
  await page.getByLabel("KvK number").fill("1234 5678");
  await page.getByLabel("Years as a professional driver").fill("6");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: "Apply to drive with us" }).click();
}

test("a car that doesn't meet the criteria is turned away with the reasons", async ({ page }) => {
  await page.goto("/drive-with-us");
  await fillApplication(page, `E2E Driver Rejected ${Date.now()}`, FAILING_PLATE);
  const alert = page.getByRole("alert").filter({ hasText: "According to the RDW register" });
  await expect(alert).toContainText("doesn't meet our criteria");
  await expect(alert).toContainText("fully electric");
  // The form keeps what was entered
  await expect(page.getByLabel("Licence plate")).toHaveValue(FAILING_PLATE);
});

test("an independent driver applies with their own car and an admin approves them onto the drivers board", async ({ page }) => {
  const name = `E2E Driver Partner ${Date.now()}`;

  // 1. Apply
  await page.goto("/drive-with-us");
  await expect(page.getByRole("heading", { name: /What we ask of your car/ })).toBeVisible();
  await fillApplication(page, name, QUALIFYING_PLATE);
  await expect(page.getByRole("status")).toContainText("Your car meets our criteria", { timeout: 15_000 });
  const reference = (await page.getByRole("status").innerText()).match(/AP-[A-Z0-9]{6}/)![0];

  // 2. The same car can't apply twice while under review
  await page.goto("/drive-with-us");
  await fillApplication(page, name, QUALIFYING_PLATE);
  await expect(page.getByText("already being reviewed")).toBeVisible();

  // 3. Review it in the admin
  await page.goto("/admin/drivers/applications");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Driver applications" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: name }).click();
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.locator("dd", { hasText: "Mercedes-Benz EQB" })).toBeVisible();
  await expect(page.getByText("Meets criteria")).toBeVisible({ timeout: 15_000 });

  // 4. Approve: the driver joins the board as a partner with their car
  await page.getByRole("combobox", { name: "Status" }).selectOption("approved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`Approved — ${name} is on the drivers board as a partner.`)).toBeVisible();

  await page.goto("/admin/drivers");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("Partner");
  await expect(row).toContainText("GHL93X");
  await expect(row.getByRole("button", { name: "Start shift" })).toBeVisible();
});
