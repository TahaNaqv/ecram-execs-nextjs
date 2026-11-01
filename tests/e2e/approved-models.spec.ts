import { expect, test } from "@playwright/test";
import { approvedModel, APPROVED_MODELS_BY_MAKE } from "../../lib/partners/criteria";

/** The Mercedes-Benz VLE 300 (in our own fleet) is on the approved list, as the EQV it replaces already was. */
test("the VLE 300 is approved, as a van that needs seven seats, and the EQV still is", () => {
  const vle = approvedModel("MERCEDES-BENZ", "VLE 300");
  expect(vle?.models).toBe("VLE 300");
  expect(vle?.minSeats).toBe(7);
  // The RDW's trade name may carry more than the number
  expect(approvedModel("MERCEDES-BENZ", "Mercedes-Benz VLE 300 Lang")).toBeTruthy();
  expect(approvedModel("MERCEDES-BENZ", "EQV 300")).toBeTruthy();
  // Other makes and the models that stay turned away are not let in by it
  expect(approvedModel("BMW", "VLE 300")).toBeUndefined();
  expect(approvedModel("MERCEDES-BENZ", "EQA 250")).toBeUndefined();
  expect(APPROVED_MODELS_BY_MAKE.find((m) => m.make === "Mercedes-Benz")?.models).toBe("EQE, EQE SUV, EQS, EQS SUV, EQV, VLE 300");
});

test("the Drive with us page lists the VLE 300 and has the comma after 'Once approved'", async ({ page }) => {
  await page.goto("/en/drive-with-us");
  await expect(page.getByText("EQE, EQE SUV, EQS, EQS SUV, EQV, VLE 300")).toBeVisible();
  await expect(page.getByText("Once approved, you join our platform and receive executive journeys across the Netherlands.")).toBeVisible();
  await page.goto("/nl/rijd-met-ons");
  await expect(page.getByText("EQE, EQE SUV, EQS, EQS SUV, EQV, VLE 300")).toBeVisible();
});
