import type { Page } from "@playwright/test";
import { CONSENT_COOKIE, CONSENT_DAYS, serializeConsent } from "../../lib/consent";
import { DEFAULT_LOCALE } from "../../lib/i18n/config";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";

/**
 * The login page is shown in the site's default language (nobody is signed in yet, so there is no preference to read),
 * so its labels follow DEFAULT_LOCALE. Tests go through this instead of typing "Email" / "Sign in", which broke when
 * the default changed from English to Dutch. Once signed in, the panel is in the admin's own language (English for
 * the test admin).
 */
const loginCopy = () => {
  const d = { en, nl }[DEFAULT_LOCALE];
  return { email: d.admin.common.email, password: d.admin.login.password, signIn: d.admin.login.signIn };
};

/** Fills in and submits the login form that is already on screen. */
export async function fillAdminLogin(page: Page, password: string = E2E_ADMIN.password) {
  const copy = loginCopy();
  await page.getByLabel(copy.email).fill(E2E_ADMIN.email);
  await page.getByLabel(copy.password).fill(password);
  await page.getByRole("button", { name: copy.signIn }).click();
}

export const E2E_ADMIN = {
  email: "e2e-admin@ecramexecs.test",
  name: "E2E Admin",
  password: "e2e-password-not-for-production",
};

/**
 * A browser that has already answered the cookie banner (declined everything optional). The banner is fixed to the bottom of
 * the window and would sit over whatever a test clicks there, so every test starts from this, through `use.storageState`
 * in playwright.config.ts, and a context made by hand with `browser.newContext` has to ask for it. The banner's own spec
 * starts from an empty state instead.
 */
export const CONSENTED_STATE = {
  cookies: [
    {
      name: CONSENT_COOKIE,
      value: serializeConsent({ analytics: false, marketing: false }),
      domain: "localhost",
      path: "/",
      expires: Math.floor(Date.now() / 1000) + CONSENT_DAYS * 24 * 60 * 60,
      httpOnly: false,
      secure: false,
      sameSite: "Lax" as const,
    },
  ],
  origins: [],
};
