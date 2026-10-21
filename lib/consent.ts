/**
 * The visitor's cookie choice, kept in one first-party cookie, `ee_consent`, so it survives between visits and is the
 * same on every page. Only strictly necessary cookies are set before a choice is made. Analytics and marketing are off
 * unless the visitor turns them on, and anything that would set such a cookie (an analytics script, a pixel, an embed
 * that tracks) must wait for `hasConsent(...)` or sit inside `<ConsentGate>`: that is the whole rule. Adding such a tool
 * also means listing its cookies and its provider in COOKIE_ROWS below, naming the provider in the privacy policy, allowing
 * its host in the Content-Security-Policy, and bumping CONSENT_VERSION: a "yes" given before the tool existed was not a
 * "yes" to it, so everyone has to be asked again. (Analytics that sets no cookies and shares nothing with a third party
 * needs no consent under Dutch law, so it may never need this at all.)
 *
 * Safe to import from client components; the reading and writing functions do nothing on the server.
 */

export const CONSENT_COOKIE = "ee_consent";
/** Bump when the categories change, so everyone is asked again about what is new. */
export const CONSENT_VERSION = 1;
/** How long a choice is remembered before the visitor is asked again. */
export const CONSENT_DAYS = 365;
/** The optional categories. "Strictly necessary" is always on and is not part of the choice. */
export const CONSENT_CATEGORIES = ["analytics", "marketing"] as const;
export type ConsentCategory = (typeof CONSENT_CATEGORIES)[number];

export type Consent = { v: number; at: string } & Record<ConsentCategory, boolean>;

/** Fired on `window` after the choice changes (in any component), so everything listening can update. */
export const CONSENT_EVENT = "ecram:consent";
/** Fired on `window` to open the preferences dialog, e.g. from the footer's "Cookie settings". */
export const OPEN_SETTINGS_EVENT = "ecram:open-cookie-settings";

/** The choice as JSON: what Next's cookie API takes, because it encodes the value itself. */
export function consentJson(choice: Record<ConsentCategory, boolean>, at = new Date().toISOString().slice(0, 10)): string {
  const consent: Consent = { v: CONSENT_VERSION, at, analytics: choice.analytics, marketing: choice.marketing };
  return JSON.stringify(consent);
}

/** The cookie value as written to `document.cookie`: the JSON, URI-encoded. */
export function serializeConsent(choice: Record<ConsentCategory, boolean>, at?: string): string {
  return encodeURIComponent(consentJson(choice, at));
}

/** The choice stored in a cookie value, or null when there is none, it is damaged or it is from an older version of the categories. */
export function parseConsent(value: string | undefined | null): Consent | null {
  if (!value) return null;
  try {
    const data = JSON.parse(decodeURIComponent(value)) as Partial<Consent> | null;
    if (!data || data.v !== CONSENT_VERSION || typeof data.at !== "string") return null;
    return { v: data.v, at: data.at, analytics: data.analytics === true, marketing: data.marketing === true };
  } catch {
    return null;
  }
}

/** The raw cookie value from a `document.cookie` string. */
export function cookieValue(cookies: string, name = CONSENT_COOKIE): string | undefined {
  for (const part of cookies.split(";")) {
    const [key, ...rest] = part.trim().split("=");
    if (key === name) return rest.join("=");
  }
  return undefined;
}

/** What `document.cookie` holds for the consent cookie right now ("" when none; null on the server). */
export function readConsentValue(): string | null {
  return typeof document === "undefined" ? null : (cookieValue(document.cookie) ?? "");
}

export function readConsent(): Consent | null {
  return parseConsent(readConsentValue());
}

/** True only when the visitor has chosen to allow this category. Before any choice, and on the server, it is false. */
export function hasConsent(category: ConsentCategory): boolean {
  return readConsent()?.[category] === true;
}

/** Stores the choice for CONSENT_DAYS and tells every listener. */
export function writeConsent(choice: Record<ConsentCategory, boolean>) {
  const secure = window.location.protocol === "https:" ? "; secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${serializeConsent(choice)}; path=/; max-age=${CONSENT_DAYS * 24 * 60 * 60}; samesite=lax${secure}`;
  window.dispatchEvent(new Event(CONSENT_EVENT));
}

/** For useSyncExternalStore: runs `onChange` when the choice changes here (or in another tab, on focus). */
export function subscribeConsent(onChange: () => void) {
  window.addEventListener(CONSENT_EVENT, onChange);
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(CONSENT_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

/**
 * The cookies the public site sets, for the preferences dialog and the privacy policy: the cookie, then the dictionary
 * keys (under `cookieConsent`) for what it is for and how long it lasts. Staff-only cookies are described in the policy,
 * not listed here. Add a row whenever a cookie is added.
 */
export const COOKIE_ROWS = [
  ["NEXT_LOCALE", "localePurpose", "localeDuration"],
  [CONSENT_COOKIE, "consentPurpose", "consentDuration"],
  ["ee_cp_access", "accessPurpose", "accessDuration"],
  ["ee_cp_challenge", "challengePurpose", "challengeDuration"],
  ["ee_cp_verified", "verifiedPurpose", "verifiedDuration"],
] as const;
