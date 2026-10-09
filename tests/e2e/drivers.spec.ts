import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./helpers";

test("an admin can add a driver, run their 10-hour shift clock and archive them", async ({ page }) => {
  const name = `E2E Driver ${Date.now()}`;

  await page.goto("/admin/drivers");
  await page.getByLabel("Email").fill(E2E_ADMIN.email);
  await page.getByLabel("Password").fill(E2E_ADMIN.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible();

  // 1. Add a driver
  await page.getByLabel("Driver name").fill(name);
  await page.getByLabel("Phone").fill("+31 6 0000 0001");
  await page.getByRole("button", { name: "Add driver" }).click();
  const offRow = page.getByRole("listitem").filter({ hasText: name });
  await expect(offRow).toBeVisible();

  // 2. Start the shift: the countdown begins at 10 hours and ticks down
  await offRow.getByRole("button", { name: "Start shift" }).click();
  const card = page.getByRole("listitem").filter({ hasText: name }).filter({ has: page.getByRole("timer") });
  const timer = card.getByRole("timer");
  await expect(timer).toHaveText(/^(10:00:00|09:59:\d\d)$/);
  const first = await timer.innerText();
  await expect(timer).not.toHaveText(first);
  await expect(card).toContainText("Remaining of 10 hours");

  // 3. End the shift and archive the driver
  await card.getByRole("button", { name: "End shift" }).click();
  const backOff = page.getByRole("listitem").filter({ hasText: name });
  await expect(backOff.getByRole("button", { name: "Start shift" })).toBeVisible();
  await backOff.getByRole("button", { name: "Archive" }).click();
  await page.getByText(/^Archived/).click();
  await expect(page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Restore" })).toBeVisible();
});
