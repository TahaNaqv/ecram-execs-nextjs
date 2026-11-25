import { interpolate } from "@/lib/i18n/interpolate";

/** Labels a person can click. Both languages are recognised so a saved template still fills in. */
const TAGS = [
  { token: "reference", labels: ["Booking Reference", "Boekingsnummer"] },
  { token: "name", labels: ["Customer Name", "Klantnaam"] },
  { token: "amount", labels: ["Total Amount", "Totaalbedrag"] },
] as const;

export type TemplateToken = (typeof TAGS)[number]["token"];

/** Turns `{reference}` into the label shown in the editor, such as `[Booking Reference]`. */
export function toFriendly(text: string, labels: Record<TemplateToken, string>) {
  return TAGS.reduce((out, tag) => out.replaceAll(`{${tag.token}}`, `[${labels[tag.token]}]`), text);
}

/** Turns a clicked label back into the placeholder the mailer fills in. */
export function toPlaceholders(text: string) {
  return TAGS.reduce((out, tag) => tag.labels.reduce((line, label) => line.replaceAll(`[${label}]`, `{${tag.token}}`), out), text);
}

/** Fills a saved template, whether it still shows a friendly label or a `{reference}` placeholder. */
export function fillTemplate(text: string, values: Record<string, string | number>) {
  return interpolate(toPlaceholders(text), values);
}
