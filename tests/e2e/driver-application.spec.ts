import { readdir } from "node:fs/promises";
import path from "node:path";
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
  // Count only once the form is on screen: the file inputs are part of it, and counting earlier reads 0
  await page.getByLabel(t.labelPlate).waitFor();
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

const DOCUMENT_FIELDS = ["chauffeurCard", "kvkExtract", "vog", "insurance"] as const;
const PDF = Buffer.concat([Buffer.from("%PDF-1.4\n"), Buffer.alloc(300, 7)]);

async function fillApplication(page: Page, name: string, plate: string, opts: { documents?: boolean } = {}) {
  await page.getByLabel(t.labelPlate).fill(plate);
  await page.getByLabel(t.labelName).fill(name);
  await page.getByLabel(t.labelEmail).fill(`partner-${Date.now()}@e2e.ecramexecs.test`);
  await page.getByLabel(t.labelPhone).fill("+31 6 0000 0002");
  await page.getByLabel(t.labelKvk).fill("1234 5678");
  await page.getByLabel(t.labelExperience).fill("6");
  if (opts.documents) {
    for (const field of DOCUMENT_FIELDS) {
      await page.locator(`#a-${field}`).setInputFiles({ name: `${field}.pdf`, mimeType: "application/pdf", buffer: PDF });
    }
  }
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

test("with document storage on, an application keeps its four documents, an admin opens one, and deleting it removes them", async ({
  page,
  request,
}) => {
  const name = `E2E Driver Docs ${Date.now()}`;
  const root = process.env.DOCUMENTS_DIR;
  await page.goto("/drive-with-us");
  await page.getByLabel(t.labelPlate).waitFor();
  test.skip(!root || (await page.locator('input[type="file"]').count()) === 0, "document storage is not configured — set DOCUMENTS_DIR (and run the server with it) to run this");

  // 1. Apply with the four documents; the browser uploads them straight to the server's disk
  await fillApplication(page, name, QUALIFYING_PLATE, { documents: true });
  await expect(page.getByRole("status")).toContainText("Your car meets our criteria", { timeout: 30_000 });

  // 2. The admin sees four documents and can open one, but only while signed in
  await page.goto("/admin/drivers/applications");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: "Driver applications" })).toBeVisible();
  await page.getByRole("link").filter({ hasText: name }).click();
  const open = page.getByRole("link", { name: /^Open PDF/ });
  await expect(open).toHaveCount(4);
  const href = new URL((await open.first().getAttribute("href"))!, page.url()).toString();

  const signedIn = await page.request.get(href);
  expect(signedIn.status()).toBe(200);
  expect(signedIn.headers()["content-disposition"]).toContain("attachment");
  expect((await signedIn.body()).subarray(0, 4).toString()).toBe("%PDF");
  expect((await request.get(href)).status()).toBe(401);

  // 3. The four files are on disk, in one folder named in the signed link
  const claim = JSON.parse(Buffer.from(new URL(href).searchParams.get("t")!.split(".")[0], "base64url").toString());
  const dir = path.join(root!, String(claim.path).split("/")[0]);
  expect((await readdir(dir)).sort()).toEqual(DOCUMENT_FIELDS.map((f) => `${f}.pdf`).sort());

  // 4. Deleting the application (a GDPR erasure) takes the files with it
  await page.getByRole("button", { name: /Delete this application/ }).click();
  await page.getByRole("button", { name: "Yes, delete permanently" }).click();
  await expect.poll(() => readdir(dir).then(() => true, () => false), { timeout: 15_000 }).toBe(false);
});


test("the application form formats the plate, limits the phone number and KvK number while typing, and offers a country code", async ({ page }) => {
  await page.goto("/en/drive-with-us");
  const plate = page.getByLabel(t.labelPlate);
  for (const [typed, shown] of [["xx999x", "XX-999-X"], ["99xx99", "99-XX-99"], ["9999xx", "99-99-XX"], ["xxxx99", "XX-XX-99"], ["h737hj", "H-737-HJ"]]) {
    await plate.fill("");
    await plate.pressSequentially(typed);
    await expect(plate).toHaveValue(shown);
  }

  // The Netherlands is chosen to begin with; a Dutch number is at most 10 digits, a British one 11
  const country = page.getByRole("combobox", { name: t.labelCountry });
  await expect(country).toHaveValue("31");
  const phone = page.locator("#a-phone");
  await phone.pressSequentially("5646454545454545");
  await expect(phone).toHaveValue("5646454545");
  await country.selectOption("44");
  await phone.fill("");
  await phone.pressSequentially("5646454545454545");
  await expect(phone).toHaveValue("56464545454");

  const kvk = page.getByLabel(t.labelKvk);
  await kvk.pressSequentially("123456789123");
  await expect(kvk).toHaveValue("12345678");
});
