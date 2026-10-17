import { expect, test, type Page } from "@playwright/test";
import { fillAdminLogin } from "./helpers";
import en from "../../lib/i18n/dictionaries/en.json";

// The form is locale-routed, so /drive-with-us lands on the English page; labels come from the
// dictionary rather than being repeated here, so a copy change cannot quietly break the suite.
const t = en.driveWithUs;

/**
 * The applicant uploads four documents whenever document storage is configured. Supplying them
 * here would write test files to the real Supabase bucket, so these tests only run without
 * storage — which is how CI runs (ci.yml sets DATABASE_URL only). Locally they skip rather than
 * fail, and the message says why.
 */
async function skipIfDocumentsRequired(page: Page) {
  const required = await page.locator('input[type="file"]').count();
  test.skip(
    required > 0,
    "document storage is configured, and completing this flow would store real files — unset DOCUMENTS_DIR and SUPABASE_URL to run it",
  );
}

// These plates are real RDW records (the check runs against the live register):
// a 2026 BMW i5 taxi that meets the criteria, a 2024 Mercedes-Benz EQB taxi that isn't an approved model,
// and a Toyota Prius that fails on several counts.
const QUALIFYING_PLATE = "KXD-26-R";
const UNAPPROVED_MODEL_PLATE = "GHL-93-X";
const FAILING_PLATE = "13-TFN-3";

async function fillApplication(page: Page, name: string, plate: string) {
  await page.getByLabel(t.labelPlate).fill(plate);
  await page.getByLabel(t.labelName).fill(name);
  await page.getByLabel(t.labelEmail).fill(`partner-${Date.now()}@e2e.ecramexecs.test`);
  await page.getByLabel(t.labelPhone).fill("+31 6 0000 0002");
  await page.getByLabel(t.labelKvk).fill("1234 5678");
  await page.getByLabel(t.labelExperience).fill("6");
  for (const box of await page.getByRole("checkbox").all()) await box.check();
  await page.getByRole("button", { name: t.submit }).click();
}

test("a car that doesn't meet the criteria is turned away with the reasons", async ({ page }) => {
  await page.goto("/drive-with-us");
  await skipIfDocumentsRequired(page);
  await fillApplication(page, `E2E Driver Rejected ${Date.now()}`, FAILING_PLATE);
  const alert = page.getByRole("alert").filter({ hasText: "According to the RDW register" });
  // The RDW register can take several seconds to answer
  await expect(alert).toContainText("doesn't meet our criteria", { timeout: 15_000 });
  await expect(alert).toContainText("fully electric");
  // The form keeps what was entered
  await expect(page.getByLabel("Licence plate")).toHaveValue(FAILING_PLATE);
});

test("an electric taxi that isn't on the approved model list is turned away", async ({ page }) => {
  await page.goto("/drive-with-us");
  await skipIfDocumentsRequired(page);
  await fillApplication(page, `E2E Driver Model ${Date.now()}`, UNAPPROVED_MODEL_PLATE);
  const alert = page.getByRole("alert").filter({ hasText: "According to the RDW register" });
  await expect(alert).toContainText("isn't on our approved model list", { timeout: 15_000 });
  await expect(alert).not.toContainText("fully electric");
});

test("an independent driver applies with their own car and an admin approves them onto the drivers board", async ({ page }) => {
  const name = `E2E Driver Partner ${Date.now()}`;

  // 1. Apply
  await page.goto("/drive-with-us");
  await skipIfDocumentsRequired(page);
  await expect(page.getByRole("heading", { name: /What we ask of your car/ })).toBeVisible();
  await expect(page.getByText("Model S, Model X")).toBeVisible();
  await fillApplication(page, name, QUALIFYING_PLATE);
  await expect(page.getByRole("status")).toContainText("Your car meets our criteria", { timeout: 15_000 });
  const reference = (await page.getByRole("status").innerText()).match(/AP-[A-Z0-9]{6}/)![0];

  // 2. The same car can't apply twice while under review
  await page.goto("/drive-with-us");
  await skipIfDocumentsRequired(page);
  await fillApplication(page, name, QUALIFYING_PLATE);
  await expect(page.getByText("already being reviewed")).toBeVisible();

  // 3. Review it in the admin
  await page.goto("/admin/drivers/applications");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: "Driver applications" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: name }).click();
  await expect(page.getByText(reference)).toBeVisible();
  await expect(page.locator("dd", { hasText: "BMW I5 EDRIVE40" })).toBeVisible();
  await expect(page.getByText("Meets criteria")).toBeVisible({ timeout: 15_000 });

  // 4. Approve: the driver joins the board as a partner with their car
  await page.getByRole("combobox", { name: "Status" }).selectOption("approved");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText(`Approved — ${name} is on the drivers board as a partner.`)).toBeVisible();

  await page.goto("/admin/drivers");
  const row = page.getByRole("listitem").filter({ hasText: name });
  await expect(row).toContainText("Partner");
  await expect(row).toContainText("KXD26R");
  await expect(row.getByRole("button", { name: "Start shift" })).toBeVisible();
});
