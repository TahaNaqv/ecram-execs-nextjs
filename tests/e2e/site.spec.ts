import { expect, test } from "@playwright/test";
import { DEFAULT_LOCALE } from "../../lib/i18n/config";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";

// Assertions read the dictionaries rather than hardcoding English, so every check runs against
// both languages and a copy change cannot silently break a test (or pass a broken page).
const DICTS = { en, nl } as const;
type Loc = keyof typeof DICTS;
const LOCALES = Object.keys(DICTS) as Loc[];

/** The public slug for a route, per locale — kept in step with lib/i18n/pathnames.ts. */
const PATHS = {
  home: { en: "/en", nl: "/nl" },
  privacy: { en: "/en/privacy", nl: "/nl/privacybeleid" },
  drive: { en: "/en/drive-with-us", nl: "/nl/rijd-met-ons" },
  corporate: { en: "/en/corporate-partner", nl: "/nl/zakelijke-partner" },
} as const;

for (const locale of LOCALES) {
  const d = DICTS[locale];

  test(`[${locale}] homepage renders the key sections in ${locale}`, async ({ page }) => {
    await page.goto(PATHS.home[locale]);
    await expect(page).toHaveTitle(d.meta.title);
    await expect(page.locator("html")).toHaveAttribute("lang", locale);
    await expect(page.locator("h1")).toContainText(d.hero.headingBefore);
    // Anchor ids stay English in both languages on purpose (D5) — the switcher carries them over.
    for (const id of ["enquire", "services", "experience", "fleet", "netherlands", "corporate", "bespoke"]) {
      await expect(page.locator(`#${id}`)).toBeAttached();
    }
    await expect(page.locator("body")).not.toContainText(/\[(PHONE|EMAIL|ADDRESS|NUMBER|CONFIRM)/);
  });

  test(`[${locale}] the other language's copy never appears`, async ({ page }) => {
    const other = DICTS[locale === "en" ? "nl" : "en"];
    await page.goto(PATHS.home[locale]);
    const body = page.locator("body");
    // A few distinctive, unambiguous strings from each section.
    for (const text of [other.hero.headingBefore, other.servicesSection.heading, other.finalCta.body]) {
      await expect(body).not.toContainText(text);
    }
  });
}

const viewports = [
  { name: "small phone", width: 320, height: 640 },
  { name: "phone", width: 390, height: 844 },
  { name: "tablet portrait", width: 768, height: 1024 },
  { name: "tablet landscape", width: 1024, height: 768 },
  { name: "laptop", width: 1366, height: 768 },
  { name: "desktop", width: 1920, height: 1080 },
];

// Dutch runs noticeably longer than English, so every breakpoint is checked in both languages.
for (const locale of LOCALES) {
  for (const vp of viewports) {
    test(`[${locale}] no horizontal scrolling on ${vp.name} (${vp.width}px)`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await page.goto(PATHS.home[locale]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBe(0);
      await expect(page.getByRole("button", { name: DICTS[locale].quoteForm.submit })).toBeVisible();
    });
  }
}

test("the bare domain sends a Dutch browser to /nl and an English one to /en, and anyone else to the default (Dutch)", async ({ browser }) => {
  for (const [browserLocale, expected] of [
    ["nl-NL", "/nl"],
    ["en-GB", "/en"],
    ["de-DE", `/${DEFAULT_LOCALE}`], // an unsupported language falls back to the default language
  ] as const) {
    // `locale` sets Accept-Language properly; `extraHTTPHeaders` loses to Chromium's own header.
    const context = await browser.newContext({ locale: browserLocale });
    const page = await context.newPage();
    await page.goto("/");
    expect(new URL(page.url()).pathname).toBe(expected);
    await context.close();
  }
});

test("an explicit language choice outlives the browser's preference", async ({ browser }) => {
  const context = await browser.newContext({ locale: "en-GB" });
  const page = await context.newPage();
  await page.goto("/en");
  // The switcher is labelled in the language of the page it is on, so this is the English label.
  await page.getByRole("link", { name: en.switcher.ariaNl }).click();
  await expect(page).toHaveURL(/\/nl$/);
  // The cookie the proxy set must now win over the English Accept-Language header.
  await page.goto("/");
  expect(new URL(page.url()).pathname).toBe("/nl");
  await context.close();
});

test("the language switcher works with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en");
  await page.getByRole("link", { name: en.switcher.ariaNl }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "nl");
  await context.close();
});

test("each page has one canonical URL per language", async ({ page }) => {
  for (const [, paths] of Object.entries(PATHS)) {
    for (const locale of LOCALES) {
      await page.goto(paths[locale]);
      const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
      expect(new URL(canonical!).pathname).toBe(paths[locale]);
      // Both languages and an x-default must be offered.
      for (const hreflang of [...LOCALES, "x-default"]) {
        await expect(page.locator(`link[rel="alternate"][hreflang="${hreflang}"]`)).toHaveCount(1);
      }
    }
  }
});

test("a locale's slug does not resolve under the other locale", async ({ request }) => {
  expect((await request.get("/en/privacybeleid")).status()).toBe(404);
  expect((await request.get("/nl/privacy", { maxRedirects: 0 })).status()).toBe(308);
});

test("unprefixed paths redirect into a language", async ({ request }) => {
  for (const path of ["/privacy", "/drive-with-us"]) {
    const res = await request.get(path, { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    // These requests carry no Accept-Language, so the default language applies
    expect(res.headers()["location"]).toContain(`/${DEFAULT_LOCALE}`);
  }
});

test("mobile menu opens with the keyboard and closes after choosing a link", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/en");
  const nav = page.locator("#primary-nav");
  await expect(nav).toBeHidden();
  await page.locator("#nav-toggle").focus();
  await page.keyboard.press("Space");
  await expect(nav).toBeVisible();
  await nav.getByRole("link", { name: en.nav.fleet }).click();
  await expect(nav).toBeHidden();
});

test("unknown URLs return a branded, bilingual 404", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  // It sits outside [locale] and cannot know the visitor's language, so it offers both (T9).
  await expect(page.getByRole("link", { name: en.notFound.cta })).toBeVisible();
  await expect(page.getByRole("link", { name: nl.notFound.cta })).toBeVisible();
});

test("an unknown path under a valid locale also 404s", async ({ page }) => {
  const res = await page.goto("/nl/bestaat-niet");
  expect(res?.status()).toBe(404);
});

test("security headers are set", async ({ request }) => {
  const res = await request.get("/en");
  const h = res.headers();
  expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
  expect(h["strict-transport-security"]).toContain("max-age=");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["x-powered-by"]).toBeUndefined();
});

test("robots.txt and the sitemap keep the admin out and list both languages", async ({ request }) => {
  expect(await (await request.get("/robots.txt")).text()).toContain("Disallow: /admin");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  for (const locale of LOCALES) {
    for (const [, paths] of Object.entries(PATHS)) expect(sitemap).toContain(`${paths[locale]}</loc>`);
  }
});
