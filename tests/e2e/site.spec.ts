import { expect, test } from "@playwright/test";

test("homepage renders the key sections", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Ecram Execs/);
  await expect(page.locator("h1")).toContainText("Every journey is part");
  for (const id of ["enquire", "services", "experience", "fleet", "netherlands", "corporate"]) {
    await expect(page.locator(`#${id}`)).toBeAttached();
  }
  // No unfilled "[PLACEHOLDER]" text is ever shown to visitors
  await expect(page.locator("body")).not.toContainText(/\[(PHONE|EMAIL|ADDRESS|NUMBER|CONFIRM)/);
});

const viewports = [
  { name: "small phone", width: 320, height: 640 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];
for (const vp of viewports) {
  test(`no horizontal scrolling on ${vp.name} (${vp.width}px)`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBe(0);
    await expect(page.getByRole("button", { name: /request tailored quote/i })).toBeVisible();
  });
}

test("mobile menu opens with the keyboard and closes after choosing a link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const nav = page.locator("#primary-nav");
  await expect(nav).toBeHidden();
  await page.locator("#nav-toggle").focus();
  await page.keyboard.press("Space");
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: "Fleet" }).click();
  await expect(nav).toBeHidden();
});

test("unknown URLs return a branded 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /return home/i })).toBeVisible();
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("robots.txt and sitemap keep the admin out of search engines", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
  expect(await (await request.get("/sitemap.xml")).text()).toContain("<loc>");
});
