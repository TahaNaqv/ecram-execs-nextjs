/**
 * Mollie (online payments): on when MOLLIE_API_KEY is set. A test_ key makes test payments (no real money); live_ real
 * ones. A test key is refused on the live site unless MOLLIE_ALLOW_TEST=1, so no customer can "pay" there with test money.
 * MOLLIE_API_URL points the e2e tests at a stand-in (tests/e2e); never set in production.
 */
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;
const LIVE_SITE = /^https:\/\/(www\.)?ecramexecs\.nl\/?$/;

export type MollieMode = "test" | "live";
export type MollieConfig = { key: string; mode: MollieMode; api: string };

/** The site's own address, for the links Mollie sends the customer back to. Null when SITE_URL is not an absolute address. */
export function siteOrigin(): string | null {
  const raw = process.env.SITE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Mollie only calls back a public address: none for a site running on this machine. */
export function webhookOrigin(): string | null {
  const origin = siteOrigin();
  if (!origin) return null;
  const host = new URL(origin).hostname;
  return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost") ? null : origin;
}

export function mollieConfig(): MollieConfig | null {
  const key = process.env.MOLLIE_API_KEY?.trim();
  if (!key || !/^(test|live)_\w{20,}$/.test(key)) return null;
  const mode: MollieMode = key.startsWith("live_") ? "live" : "test";
  if (mode === "test" && LIVE_SITE.test(process.env.SITE_URL?.trim() ?? "") && process.env.MOLLIE_ALLOW_TEST !== "1") return null;
  if (!siteOrigin()) return null;
  const override = process.env.MOLLIE_API_URL;
  const api = override && LOOPBACK.test(override) ? override : "https://api.mollie.com/v2";
  return { key, mode, api };
}

export const mollieConfigured = () => mollieConfig() !== null;

/** Where the customer may be sent to pay: Mollie's own checkout, or the e2e stand-in. Nothing else. */
export function safeCheckoutUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol === "https:" && (url.hostname === "mollie.com" || url.hostname.endsWith(".mollie.com"))) return url.toString();
    const override = process.env.MOLLIE_API_URL;
    if (override && LOOPBACK.test(override) && url.origin === new URL(override).origin) return url.toString();
    return null;
  } catch {
    return null;
  }
}
