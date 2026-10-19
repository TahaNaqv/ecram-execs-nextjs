/**
 * Substitutes `{name}` placeholders in a dictionary string.
 *
 * Deliberately minimal: English and Dutch share a single plural category (one/other),
 * so none of ICU's plural/select machinery earns its keep here. If a third locale with
 * richer plural rules is ever added, this is the one place to revisit.
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (token, key: string) => {
    if (key in values) return String(values[key]);
    // A missing value would render "{year}" to a visitor, so make it loud in development
    // rather than shipping a broken string quietly.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[i18n] no value for "${key}" in: ${template}`);
    }
    return token;
  });
}
