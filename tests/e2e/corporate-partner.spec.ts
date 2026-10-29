import { expect, test, type Page } from "@playwright/test";
import en from "../../lib/i18n/dictionaries/en.json";
import nl from "../../lib/i18n/dictionaries/nl.json";
import {
  NEW_PASSWORD,
  ORIGIN,
  PASSWORD,
  SECRET,
  holdChallenge,
  logIn,
  newEmail,
  ownAddress,
  seedBooking,
  seedChallenge,
  seedContact,
  submit,
  t,
} from "./corporate-helpers";
import { fillAdminLogin, CONSENTED_STATE } from "./helpers";

test.skip(!SECRET, "Set CORPORATE_OTP_SECRET (the same value the server runs with) to run the Corporate Partner flow");

const failedMessage = t.loginFailed.replace("{max}", "5").replace("{minutes}", "15");

/**
 * Waits for a refused sign-in to have been answered. The form is replaced after every answer, which empties the
 * password box, so waiting for that keeps an identical message from an earlier attempt from satisfying the check.
 */
async function refused(page: Page) {
  await expect(page.locator("#c-password")).toHaveValue("");
  await expect(page.locator("form p[aria-live]").first()).toHaveText(failedMessage);
}

/** The code step: sign-up and reset first ask for the emailed code on a screen of its own. */
async function verify(page: Page, code: string) {
  await page.fill("#c-code", code);
  await submit(page, t.verifyCta);
}

/** The password step that follows a correct code. */
async function choose(page: Page, password: string, confirm = password, button = t.createAccountCta) {
  await page.fill("#c-password", password);
  await page.fill("#c-confirmPassword", confirm);
  await submit(page, button);
}

/** Both steps, for the tests that are not about them. */
async function finish(page: Page, code: string, password: string, confirm = password, button = t.createAccountCta) {
  await verify(page, code);
  await expect(page.locator("#c-password")).toBeVisible();
  await choose(page, password, confirm, button);
}

test("the entry page offers log in and sign up, in both languages", async ({ page }) => {
  await page.goto("/en/corporate-partner");
  await expect(page.getByRole("heading", { name: t.optionLoginTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: t.optionSignupTitle })).toBeVisible();
  await page.getByRole("link", { name: t.optionSignupCta }).click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/signup$/);

  await page.goto("/en/corporate-partner");
  await page.getByRole("link", { name: t.optionLoginCta }).click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/login$/);

  // The same screens under Dutch addresses, and the language switch lands on the same screen in the other language
  await page.goto("/nl/zakelijke-partner");
  await page.getByRole("link", { name: nl.corporatePartner.optionLoginCta }).click();
  await expect(page).toHaveURL(/\/nl\/zakelijke-partner\/inloggen$/);
  await expect(page.getByRole("heading", { name: nl.corporatePartner.loginHeading, level: 1 })).toBeVisible();
  await page.getByRole("link", { name: nl.switcher.ariaEn }).click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/login$/);
});

test("the account page is behind sign-in, and the sign-in screens stay out of search results", async ({ page, request }) => {
  await page.goto("/en/corporate-partner/account");
  await expect(page).toHaveURL(/\/en\/corporate-partner\/login(\?.*)?$/);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute("content", /noindex/);

  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("/en/corporate-partner</loc>");
  for (const hidden of ["corporate-partner/login", "corporate-partner/signup", "corporate-partner/forgot-password", "corporate-partner/account", "zakelijke-partner/inloggen"]) {
    expect(sitemap).not.toContain(hidden);
  }
});

test("the sign-up request step validates its fields", async ({ page }) => {
  await page.goto("/en/corporate-partner/signup");
  await page.getByRole("button", { name: t.sendCode }).click();
  await expect(page.locator("#c-email-error")).toHaveText(en.forms.emailInvalid);
  await expect(page.locator("#c-name-error")).toHaveText(en.forms.nameRequired);
  await expect(page.locator("#c-position-error")).toHaveText(t.positionRequired);
});

test("signing in says the same thing for every failure, and a paused account stays shut until the password is reset", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("lock");
  await seedContact(email, PASSWORD);

  // An address we have never seen, and a known address with the wrong password, are indistinguishable
  await logIn(page, newEmail("nobody"), "not the password at all");
  await refused(page);
  for (let i = 0; i < 5; i++) {
    await page.fill("#c-email", email);
    await page.fill("#c-password", `wrong password number ${i}`);
    await submit(page, t.loginCta);
    await refused(page);
  }

  // Five failures pause the account; even the right password is now refused, with the same answer, and nobody is signed in
  await page.fill("#c-email", email);
  await page.fill("#c-password", PASSWORD);
  await submit(page, t.loginCta);
  await refused(page);
  await page.goto("/en/corporate-partner/account");
  await expect(page).toHaveURL(/\/login(\?.*)?$/);

  // A password reset is the way back in, and it lifts the pause
  await holdChallenge(context, await seedChallenge(email, "135790", { purpose: "reset" }));
  await page.goto("/en/corporate-partner/forgot-password");
  await expect(page.getByRole("heading", { name: t.resetVerifyHeading })).toBeVisible();
  await finish(page, "135790", NEW_PASSWORD, NEW_PASSWORD, t.resetCta);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);
});

test("a partner can sign out, sign in again, and sees their introductions", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("signup");
  await seedContact(email, PASSWORD);
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);
  await expect(page.getByRole("heading", { name: en.portal.headingBookings, level: 1 })).toBeVisible();

  // No bookings yet, and the company introduction is still to do: that is offered, and leads to the form
  await expect(page.getByText(en.portal.emptyOpen)).toBeVisible();
  await page.getByRole("link", { name: en.portal.introCtaLink }).click();
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account\/introduction$/);

  // The booker's own details are shown, not typed
  await expect(page.getByRole("heading", { name: t.formHeading })).toBeVisible();
  await expect(page.locator("#c-bookerEmail")).toHaveValue(email);
  await expect(page.locator("#c-bookerName")).toHaveValue("Anouk Jansen");
  await expect(page.locator("#c-phoneCountry")).toHaveValue("31");

  // The client's vehicles and choices, in the client's order (the first option is the placeholder)
  const optionTexts = (id: string) => page.locator(`${id} option`).evaluateAll((os) => os.slice(1).map((o) => (o as HTMLOptionElement).text));
  expect(await optionTexts("#c-vehicle")).toEqual([
    "Audi e-tron GT",
    "Mercedes-Benz VLE 300",
    "Cadillac Escalade IQ",
    "Range Rover EV",
    "Hongqi E-HS9",
  ]);
  // The short lists are choice pills (radio buttons), not drop-downs
  const radioValues = (name: string) => page.locator(`input[type=radio][name=${name}]`).evaluateAll((os) => os.map((o) => (o as HTMLInputElement).value));
  expect(await radioValues("contactMethod")).toEqual(["email", "phone", "whatsapp"]);
  expect(await radioValues("tripTime")).toEqual(["morning", "afternoon", "evening"]);
  expect(await radioValues("duration")).toEqual(["2_4", "2_8", "2_12", "2_24"]);

  await page.fill("#c-company", "Orion Holdings B.V.");
  await page.fill("#c-companyNumber", "12345678");
  await page.fill("#c-phone", "6 1234 5678");
  await page.locator("#c-contactMethod-whatsapp").check();
  await page.fill("#c-signatory", "Marieke van Dijk");
  await page.fill("#c-pointOfCall", "Jeroen Bakker");
  await page.selectOption("#c-vehicle", "mercedes_vle_300");
  await page.locator("#c-tripTime-morning").check();
  await page.locator("#c-duration-2_8").check();
  await page.getByRole("button", { name: t.submit }).click();
  await expect(page.getByRole("status")).toContainText("Anouk");

  // Reloading keeps the session (checked against the database every time), and the introduction is listed
  await page.goto("/en/corporate-partner/account/introduction");
  await expect(page.getByRole("heading", { name: t.introductionsHeading })).toBeVisible();
  await expect(page.getByText(/EE-[A-Z0-9]{6}/)).toBeVisible();
  await expect(page.getByText("Orion Holdings B.V.")).toBeVisible();

  // An introduction is not a booking: it is not in the bookings list, and the prompt to send one is gone
  await page.goto("/en/corporate-partner/account");
  await expect(page.getByText(en.portal.emptyOpen)).toBeVisible();
  await expect(page.getByRole("heading", { name: en.portal.introCtaTitle })).toHaveCount(0);

  // Sign out: the page closes, and signing back in with the password opens it again
  await page.getByRole("button", { name: t.signOut }).click();
  await expect(page).toHaveURL(/\/en\/corporate-partner$/);
  await page.goto("/en/corporate-partner/account");
  await expect(page).toHaveURL(/\/login(\?.*)?$/);
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);

  // The team sees the account, and the request
  await page.goto("/admin/login");
  await fillAdminLogin(page);
  await page.waitForURL((url) => !url.pathname.endsWith("/login"));
  await page.goto("/admin/corporate");
  const row = page.getByRole("listitem").filter({ hasText: email });
  await expect(row).toBeVisible();
  await expect(row).toContainText(en.admin.corporate.hasAccount);
});

test("the code and the password are separate steps; the password is never sent back to the page", async ({ page, context }) => {
  await ownAddress(context);
  const email = `pw-rules-${Date.now()}@e2e.ecramexecs.test`;
  await holdChallenge(context, await seedChallenge(email, "111111", { purpose: "reset" }));
  await page.goto("/en/corporate-partner/forgot-password");

  // A wrong code stays on the code step, with the attempts left; there is no password box to fill in yet
  await expect(page.locator("#c-password")).toHaveCount(0);
  await verify(page, "000000");
  await expect(page.locator("#c-code-error")).toContainText("Attempts left: 4");
  await expect(page.locator("#c-password")).toHaveCount(0);

  // The right code opens the password step
  await verify(page, "111111");
  await expect(page.getByRole("heading", { name: t.resetPasswordHeading })).toBeVisible();
  await expect(page.getByText(email, { exact: false }).first()).toBeVisible(); // the step says which address the password is for
  await expect(page.locator("#c-code")).toHaveCount(0);

  await choose(page, "short", "short", t.resetCta);
  await expect(page.locator("#c-password-error")).toHaveText(t.passwordTooShort.replace("{min}", "12"));
  await choose(page, PASSWORD, "something else entirely", t.resetCta);
  await expect(page.locator("#c-confirmPassword-error")).toHaveText(t.passwordMismatch);
  await choose(page, email, email, t.resetCta);
  await expect(page.locator("#c-password-error")).toHaveText(t.passwordSameAsEmail);
  // The boxes are empty again after every refusal, and the code is not asked for again
  await expect(page.locator("#c-password")).toHaveValue("");
  await expect(page.locator("#c-confirmPassword")).toHaveValue("");
  await expect(page.locator("#c-code")).toHaveCount(0);

  await choose(page, PASSWORD, PASSWORD, t.resetCta);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);
});

test("an unfinished sign-up is cleared on refresh and when the page is opened again", async ({ page, context }) => {
  await page.goto("/en/corporate-partner/signup");
  await page.fill("#c-email", "kept@e2e.ecramexecs.test");
  await page.fill("#c-name", "Kept Name");
  await page.fill("#c-position", "Kept Role");
  await page.fill("#c-companyName", "Kept BV");
  await page.fill("#c-kvkNumber", "12345678");
  await page.fill("#c-phone", "+31612345678");
  await page.reload();
  await expect(page.locator("#c-email")).toHaveValue("");
  await expect(page.locator("#c-name")).toHaveValue("");
  await expect(page.locator("#c-position")).toHaveValue("");
  await expect(page.locator("#c-companyName")).toHaveValue("");
  await expect(page.locator("#c-kvkNumber")).toHaveValue("");
  await expect(page.locator("#c-phone")).toHaveValue("");
  await expect(page.locator("#c-code")).toHaveCount(0);

  await page.fill("#c-email", "kept@e2e.ecramexecs.test");
  await page.goto("/en/corporate-partner");
  await page.goto("/en/corporate-partner/signup");
  await expect(page.locator("#c-email")).toHaveValue("");

  // A code already sent does not lock this visit to that address
  await holdChallenge(context, await seedChallenge(newEmail("stuck"), "246810"));
  await page.goto("/en/corporate-partner/signup");
  await expect(page.locator("#c-email")).toHaveValue("");
  await expect(page.getByRole("heading", { name: t.verifyHeading })).toHaveCount(0);
  await expect(page.locator("#c-code")).toHaveCount(0);
  await expect.poll(async () => (await context.cookies()).some((cookie) => cookie.name === "ee_cp_challenge")).toBe(false);
});

test("five wrong codes lock the challenge", async ({ page, context }) => {
  await ownAddress(context);
  await holdChallenge(context, await seedChallenge(newEmail("wrong"), "111111", { purpose: "reset" }));
  await page.goto("/en/corporate-partner/forgot-password");

  // Wait for each answer before guessing again: the form is replaced after every response
  for (const left of [4, 3, 2, 1]) {
    await verify(page, "000000");
    await expect(page.locator("#c-code-error")).toContainText(`Attempts left: ${left}`);
  }
  await verify(page, "000000");
  // The fifth wrong guess spends the attempts; a new code is needed, and the visitor is taken back to the start
  await expect(page.getByText(t.tooManyAttempts)).toBeVisible();
  await expect(page.locator("#c-code")).toHaveCount(0);
  await expect(page.locator("#c-email")).toBeVisible();
});

test("an expired code is not offered, and a code only belongs to the page it was sent for", async ({ page, context }) => {
  await holdChallenge(context, await seedChallenge(newEmail("expired"), "135790", { expired: true }));
  await page.goto("/en/corporate-partner/signup");
  // An expired challenge is not offered as a pending code; the visitor starts again
  await expect(page.locator("#c-email")).toBeVisible();
  await expect(page.locator("#c-code")).toHaveCount(0);

  // A reset code resumes on the reset page only, and a sign-up code on the sign-up page only
  await holdChallenge(context, await seedChallenge(newEmail("purpose"), "135790", { purpose: "reset" }));
  await page.goto("/en/corporate-partner/signup");
  await expect(page.locator("#c-code")).toHaveCount(0);
  await expect(page.locator("#c-email")).toBeVisible();
  await page.goto("/en/corporate-partner/forgot-password");
  await expect(page.locator("#c-code")).toBeVisible();
});

test("the reset form moves on for an address nobody has registered, so it reveals nothing", async ({ page, context }) => {
  await ownAddress(context);
  await page.goto("/en/corporate-partner/forgot-password");
  await page.fill("#c-email", newEmail("stranger"));
  await submit(page, t.sendResetCode);
  await expect(page.getByRole("heading", { name: t.resetVerifyHeading })).toBeVisible();
});

test("the reset form answers the same for a known and an unknown address, even when asked twice in a row", async ({ page, context }) => {
  await ownAddress(context);
  const known = newEmail("known");
  await seedContact(known, PASSWORD);
  // A known address is the only one that could answer "wait a minute" or "not sent" (no mail provider runs here, so the
  // first request for it is not sent and the second comes within the minute). Neither may show.
  for (const email of [known, newEmail("unknown")]) {
    await page.goto("/en/corporate-partner/forgot-password");
    for (let i = 0; i < 2; i++) {
      await page.fill("#c-email", email);
      await submit(page, t.sendResetCode);
      await expect(page.getByRole("heading", { name: t.resetVerifyHeading })).toBeVisible();
      await page.getByRole("button", { name: t.changeEmail }).click();
    }
  }
});

test("a reset code sets a new password and ends other sign-ins", async ({ page, context, browser }) => {
  await ownAddress(context);
  const email = newEmail("again");
  await seedContact(email, PASSWORD);

  // Another browser is signed in with the old password
  const otherContext = await browser.newContext({ baseURL: ORIGIN, storageState: CONSENTED_STATE });
  await ownAddress(otherContext);
  const other = await otherContext.newPage();
  await logIn(other, email, PASSWORD);
  await expect(other).toHaveURL(/\/en\/corporate-partner\/account$/);

  // The owner of the address enters a code and a new password. Sign-up no longer resumes that code.
  await holdChallenge(context, await seedChallenge(email, "864209", { purpose: "reset", password: PASSWORD }));
  await page.goto("/en/corporate-partner/forgot-password");
  await finish(page, "864209", NEW_PASSWORD, NEW_PASSWORD, t.resetCta);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);

  // The other browser was signed out by the change; the old password no longer opens anything
  await other.goto("/en/corporate-partner/account");
  await expect(other).toHaveURL(/\/login(\?.*)?$/);
  await other.fill("#c-email", email);
  await other.fill("#c-password", PASSWORD);
  await submit(other, t.loginCta);
  await refused(other);
  await other.goto("/en/corporate-partner/account");
  await expect(other).toHaveURL(/\/login(\?.*)?$/);
  await other.fill("#c-email", email);
  await other.fill("#c-password", NEW_PASSWORD);
  await submit(other, t.loginCta);
  await expect(other).toHaveURL(/\/en\/corporate-partner\/account$/);
  await otherContext.close();
});

test("a signed-in visitor is offered their account, and the entry page still offers both ways in", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("signedin");
  await seedContact(email, PASSWORD);
  await logIn(page, email, PASSWORD);
  await expect(page).toHaveURL(/\/en\/corporate-partner\/account$/);

  await page.goto("/en/corporate-partner");
  await expect(page.getByRole("link", { name: t.goToAccount })).toBeVisible();
  // QA round 3, bug 1: "Become a Corporate Partner" leads to the same ways in as the hero's login button, signed in or not
  await expect(page.getByRole("link", { name: t.optionLoginCta })).toBeVisible();
  await expect(page.getByRole("link", { name: t.optionSignupCta })).toBeVisible();
  await page.goto("/en/corporate-partner/login");
  await expect(page.getByRole("link", { name: t.goToAccount })).toBeVisible();
  await page.goto("/en/corporate-partner/signup");
  await expect(page.getByRole("link", { name: t.goToAccount })).toBeVisible();
});

test("opening account creation does not resume a previous address or show earlier requests", async ({ page, context }) => {
  await ownAddress(context);
  const email = newEmail("earlier");
  // Earlier requests: one with this address (typed in capitals, as people do), one with someone else's
  const mine = await seedBooking({ contactId: null, email: email.toUpperCase(), status: "confirmed" });
  const other = await seedBooking({ contactId: null, email: newEmail("someone-else"), status: "confirmed" });
  await holdChallenge(context, await seedChallenge(email, "246810"));

  await page.goto("/en/corporate-partner/signup");
  await expect(page.locator("#c-email")).toHaveValue("");
  await expect(page.locator("#c-code")).toHaveCount(0);
  await expect(page.getByText(email, { exact: false })).toHaveCount(0);
  await expect(page.getByText(mine.reference)).toHaveCount(0);
  await expect(page.getByText(other.reference)).toHaveCount(0);
  await page.goto("/en/corporate-partner/account");
  await expect(page).toHaveURL(/\/login(\?.*)?$/);
});
