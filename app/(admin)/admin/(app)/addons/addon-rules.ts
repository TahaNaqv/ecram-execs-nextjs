// Labels and field rules for the Add-ons page, shared by the server actions and the forms.

export const ADDON_LABELS: Record<string, string> = {
  champagne: "Champagne",
  chocolates: "Chocolates",
  flowers: "Flowers",
  newspapers: "Newspapers",
};

export function addonLabel(key: string) {
  return ADDON_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1);
}

export const LOW_STOCK = 5;

export const LIMITS = {
  nameMin: 2,
  nameMax: 80,
  emailMax: 254,
  phoneMax: 30,
  phoneDigitsMin: 6,
  phoneDigitsMax: 15,
  notesMax: 500,
  stockMax: 9999,
} as const;

/** For the HTML pattern attribute (browsers compile it with the v flag, hence the escapes). */
export const PHONE_PATTERN = "[0-9+\\(\\)\\- ]+";
export const PHONE_HINT = "Digits, spaces, +, - and ( ) only, with 6 to 15 digits.";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_CHARS = /^[0-9+()\- ]+$/;
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SupplierInput = { name: string; email: string | null; phone: string | null; notes: string | null };

const text = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Checks the supplier fields. Returns the cleaned values or the first problem, in words for the admin. */
export function parseSupplier(formData: FormData): { data: SupplierInput } | { error: string } {
  const name = text(formData, "name").replace(/\s+/g, " ");
  const email = text(formData, "email");
  const phone = text(formData, "phone").replace(/\s+/g, " ");
  const notes = text(formData, "notes");

  if (name.length < LIMITS.nameMin) return { error: `Supplier name needs at least ${LIMITS.nameMin} characters.` };
  if (name.length > LIMITS.nameMax) return { error: `Supplier name can be at most ${LIMITS.nameMax} characters.` };
  if (email && (email.length > LIMITS.emailMax || !EMAIL.test(email))) return { error: "Enter a valid email address, like name@company.com." };
  if (phone) {
    const digits = phone.replace(/\D/g, "").length;
    if (phone.length > LIMITS.phoneMax || !PHONE_CHARS.test(phone)) return { error: "Phone can only contain digits, spaces, +, - and ( )." };
    if (digits < LIMITS.phoneDigitsMin || digits > LIMITS.phoneDigitsMax) {
      return { error: `Phone needs ${LIMITS.phoneDigitsMin} to ${LIMITS.phoneDigitsMax} digits (this one has ${digits}).` };
    }
  }
  if (notes.length > LIMITS.notesMax) return { error: `Notes can be at most ${LIMITS.notesMax} characters.` };

  return { data: { name, email: email ? email.toLowerCase() : null, phone: phone || null, notes: notes || null } };
}

/** On-hand stock: a whole number from 0 to 9999. */
export function parseStock(raw: FormDataEntryValue | null): { value: number } | { error: string } {
  const value = String(raw ?? "").trim();
  if (!/^\d+$/.test(value)) return { error: `On hand must be a whole number from 0 to ${LIMITS.stockMax}.` };
  const count = Number(value);
  if (count > LIMITS.stockMax) return { error: `On hand can be at most ${LIMITS.stockMax}.` };
  return { value: count };
}
