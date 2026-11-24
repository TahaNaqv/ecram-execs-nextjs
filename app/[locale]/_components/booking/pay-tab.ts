/**
 * The Mollie tab for Book and pay on the website (24 Nov 2026). Browsers open a new tab only during the visitor's own
 * click, but the payment exists only once the server has answered, by which time the click no longer counts: every
 * booking ended on "the payment page was blocked". So the tab is opened at the click, with a short note, and sent to
 * Mollie when the answer comes. When the booking is not sent (an error, nothing to pay), the tab is closed again.
 * The partner portal does not use this: it sends its own tab to Mollie.
 */
let held: Window | null = null;

/** Opens the tab now, during the click. Without a tab (the browser refused even this) the booking page's Pay now is the way. */
export function holdPayTab(note: string): void {
  dropPayTab();
  let tab: Window | null = null;
  try {
    tab = window.open("", "_blank");
  } catch {
    tab = null;
  }
  if (!tab) return;
  try {
    // Mollie's page must not be able to reach back into the booking
    tab.opener = null;
    // A new tab starts with a copy of this tab's session storage, which still holds the booking form at its last step:
    // opened from there, /book could restore it and send the booking again
    tab.sessionStorage.clear();
    tab.document.title = note;
    const line = tab.document.createElement("p");
    line.textContent = note;
    line.setAttribute("style", "font-family:Georgia,serif;margin:48px;color:#0a1942;font-size:18px");
    tab.document.body.appendChild(line);
  } catch {
    // the note is a nicety; the tab itself is what matters
  }
  held = tab;
}

/** Sends the held tab to Mollie. False when there is no tab (refused, or closed by the visitor). */
export function sendPayTab(url: string): boolean {
  const tab = held;
  held = null;
  if (!tab || tab.closed) return false;
  try {
    tab.location.replace(url);
    return true;
  } catch {
    return false;
  }
}

/** Closes the held tab: the booking was not sent, or there is nothing to pay now. */
export function dropPayTab(): void {
  const tab = held;
  held = null;
  try {
    tab?.close();
  } catch {
    // already gone
  }
}
