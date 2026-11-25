import { expect, test } from "@playwright/test";
import { fillAdminLogin } from "./helpers";

test("an admin can add a driver, run their 10-hour shift clock and archive them", async ({ page }) => {
  const name = `E2E Driver ${Date.now()}`;

  await page.goto("/admin/drivers");
  await fillAdminLogin(page);
  await expect(page.getByRole("heading", { name: "Drivers" })).toBeVisible();

  await page.getByRole("button", { name: "Add driver", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Driver name").fill(name);
  await dialog.getByLabel("Phone").fill("+31 6 0000 0001");
  await dialog.getByRole("button", { name: "Add driver" }).click();
  const row = page.getByRole("row").filter({ hasText: name });
  await expect(row).toBeVisible();

  await row.getByRole("button", { name: "Start shift" }).click();
  const timer = row.getByRole("timer");
  await expect(timer).toHaveText(/^\d{2}:\d{2}:\d{2}$/);
  const first = await timer.innerText();
  await expect(timer).not.toHaveText(first);

  await row.getByRole("button", { name: "End shift" }).click();
  await expect(row.getByRole("button", { name: "Start shift" })).toBeVisible();
  await row.getByRole("button", { name: "Remove" }).click();
  await page.getByText(/^Archived/).click();
  await expect(page.getByRole("listitem").filter({ hasText: name }).getByRole("button", { name: "Restore" })).toBeVisible();
});
