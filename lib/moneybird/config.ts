/**
 * Moneybird (accounting): every confirmed booking becomes an invoice there (sync.ts). Off unless all four are set.
 * The two ledger accounts are required on purpose: booking revenue to the wrong account would have to be put right by hand.
 * MONEYBIRD_API_URL points the e2e tests at a stand-in (tests/e2e/global-setup.ts); never set in production.
 */
const LOOPBACK = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/;

export type MoneybirdConfig = {
  token: string;
  administrationId: string;
  ledgerRides: string;
  ledgerExtras: string;
  api: string;
};

export function moneybirdConfig(): MoneybirdConfig | null {
  const token = process.env.MONEYBIRD_TOKEN?.trim();
  const administrationId = process.env.MONEYBIRD_ADMINISTRATION_ID?.trim();
  const ledgerRides = process.env.MONEYBIRD_LEDGER_RIDES?.trim();
  const ledgerExtras = process.env.MONEYBIRD_LEDGER_EXTRAS?.trim();
  if (!token || !administrationId || !ledgerRides || !ledgerExtras) return null;
  const override = process.env.MONEYBIRD_API_URL;
  const api = override && LOOPBACK.test(override) ? override : "https://moneybird.com/api/v2";
  return { token, administrationId, ledgerRides, ledgerExtras, api };
}

export const moneybirdConfigured = () => moneybirdConfig() !== null;

/** The invoice in Moneybird's own web app, for the team. */
export function moneybirdInvoiceLink(moneybirdId: string): string | null {
  const config = moneybirdConfig();
  return config ? `https://moneybird.com/${config.administrationId}/sales_invoices/${moneybirdId}` : null;
}
