import { CONSENT_CATEGORIES, readConsent, writeConsent, type ConsentCategory } from "@/lib/consent";
import { persistConsent } from "@/lib/consent-actions";

/**
 * Records a choice: the browser's own cookie first (so the banner and any gate react straight away), then the same cookie
 * from the server (so it lasts the full twelve months everywhere; see persistConsent). If a category that was on is now
 * off, the page reloads once the server has answered, because a script that is already running cannot be un-run.
 */
export async function saveConsent(choice: Record<ConsentCategory, boolean>) {
  const before = readConsent();
  writeConsent(choice);
  try {
    await persistConsent(choice);
  } catch {
    // The browser's cookie is already in place; the server's copy only extends its lifetime
  }
  if (before && CONSENT_CATEGORIES.some((category) => before[category] && !choice[category])) window.location.reload();
}
