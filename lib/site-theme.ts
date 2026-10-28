/**
 * The website's colour theme. "navy" is a deep-blue background (#000f4d) with the greys and paper tones tinted to match;
 * "classic" is the original near-black; "lightblue" is a pale sky-blue page with navy type; "midnight" is a softer, slightly lighter dark blue (#0f2a63). The default is navy.
 *
 * To go back to the original look without touching any code: put `SITE_THEME=classic` in the server's `.env` and run
 * `./scripts/deploy.sh` (the pages are built in advance, so the setting is read when the site is built). Removing the line,
 * or any other value, gives navy again. The colours themselves are in app/[locale]/site.css (`:root[data-theme="navy"]`).
 */
export type SiteTheme = "navy" | "classic" | "lightblue" | "midnight";

const THEMES: SiteTheme[] = ["classic", "lightblue", "midnight"];

export const siteTheme: SiteTheme =
  THEMES.find((name) => name === process.env.SITE_THEME) ?? "navy";

/** The browser's address-bar colour on phones: the page background of each theme. */
export const themeColor: Record<SiteTheme, string> = { navy: "#000f4d", classic: "#0a0a0b", lightblue: "#d3e5f8", midnight: "#0f2a63" };
