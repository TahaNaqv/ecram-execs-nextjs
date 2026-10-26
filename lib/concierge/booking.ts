import "server-only";
import { ne } from "drizzle-orm";
import { tripFields, emptyTrip, MAX_BAGS, type Trip } from "@/app/[locale]/_components/booking/trip";
import { db } from "@/lib/db";
import { vehicles } from "@/lib/db/schema";
import { FLEET, VEHICLE_CHOICES, normalizeVehicleKey } from "@/lib/fleet/vehicles";
import type { Locale } from "@/lib/i18n/config";
import { cleanPhoneInput } from "@/lib/phone";
import { PLACE_KINDS, type PlaceKind } from "@/lib/places/types";
import { COUNTRY_CODES, HOURLY_DURATIONS } from "@/lib/quotes/constants";
import { MAX_STOPS, asWait } from "@/lib/quotes/stops";
import { amsterdamNow, quoteSchema, type QuoteMessages } from "@/lib/quotes/validation";

/**
 * Booking by chat. The concierge model fills in a DRAFT of the booking through a tool; this file is everything the server
 * does with it: cleaning what arrives, saying what is still missing or wrong, and, once it is complete, turning it into
 * exactly the fields the booking form posts (it goes through `tripFields`, the form's own function, and is checked with the
 * form's own `quoteSchema`). The model never sends a booking: the visitor presses the button on the summary card, which
 * calls the same `submitQuote` action as the form.
 */
export type Draft = {
  mode?: "oneway" | "hourly";
  from?: string;
  to?: string;
  /** What the places are, when the model knows (an airport the list of known names does not have): decides the trip's kind and the flight field */
  fromKind?: PlaceKind;
  toKind?: PlaceKind;
  stops?: { place: string; wait: number }[];
  hours?: number;
  /** Netherlands wall-clock "YYYY-MM-DDTHH:mm" */
  at?: string;
  ret?: string;
  passengers?: number;
  bags?: number;
  flight?: string;
  /** A fleet key, or "advise" for no preference */
  vehicle?: string;
  purpose?: "business" | "private";
  name?: string;
  email?: string;
  phone?: string;
  passengerName?: string;
  passengerPhone?: string;
  notes?: string;
};
export type DraftKey = keyof Draft;

const WALL_CLOCK = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const text = (max: number) => (v: unknown) => (typeof v === "string" && v.trim() ? v.trim().replace(/[ \t]+/g, " ").slice(0, max) : undefined);
const whole = (min: number, max: number) => (v: unknown) => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : undefined;
};
const oneOf = <T extends string>(options: readonly T[]) => (v: unknown) => (typeof v === "string" && (options as readonly string[]).includes(v) ? (v as T) : undefined);

/** What each field accepts. A value that does not fit comes back undefined and is reported as rejected, never stored. */
const CLEAN: { [K in DraftKey]-?: (v: unknown) => Draft[K] | undefined } = {
  mode: oneOf(["oneway", "hourly"] as const),
  from: text(200),
  to: text(200),
  fromKind: oneOf(PLACE_KINDS),
  toKind: oneOf(PLACE_KINDS),
  stops: (v) => {
    if (!Array.isArray(v)) return undefined;
    const stops = v
      .map((s) => (s && typeof s === "object" ? { place: text(200)((s as { place?: unknown }).place), wait: asWait((s as { wait?: unknown }).wait) } : null))
      .filter((s): s is { place: string; wait: number } => Boolean(s?.place))
      .slice(0, MAX_STOPS);
    return stops;
  },
  hours: (v) => {
    const h = whole(1, 24)(v);
    return h !== undefined && (HOURLY_DURATIONS as readonly number[]).includes(h) ? h : undefined;
  },
  at: (v) => (typeof v === "string" && WALL_CLOCK.test(v.trim()) ? v.trim() : undefined),
  ret: (v) => (typeof v === "string" && WALL_CLOCK.test(v.trim()) ? v.trim() : undefined),
  passengers: whole(1, 50),
  bags: whole(0, MAX_BAGS),
  flight: text(12),
  vehicle: (v) => {
    if (typeof v !== "string") return undefined;
    const key = normalizeVehicleKey(v) ?? v.trim();
    return (VEHICLE_CHOICES as readonly string[]).includes(key) ? key : undefined;
  },
  purpose: oneOf(["business", "private"] as const),
  name: text(120),
  email: (v) => (typeof v === "string" && v.trim() ? v.trim().toLowerCase().slice(0, 200) : undefined),
  phone: text(30),
  passengerName: text(120),
  passengerPhone: text(30),
  notes: text(2000),
};
const KEYS = Object.keys(CLEAN) as DraftKey[];

/** A draft from the browser: only the known fields, each cleaned. Anything else, and anything that does not fit, is dropped. */
export function cleanDraft(raw: unknown): Draft {
  const out: Record<string, unknown> = {};
  if (raw && typeof raw === "object") {
    for (const key of KEYS) {
      const value = CLEAN[key]((raw as Record<string, unknown>)[key]);
      if (value !== undefined) out[key] = value;
    }
  }
  return out as Draft;
}

/**
 * Applies the model's changes to a draft. A field set to null (or to an empty text) is cleared; a value that does not fit its
 * field is left out and named in `rejected`, so the model can say what it needs. An unknown field is named too.
 */
export function applyPatch(draft: Draft, patch: unknown): { draft: Draft; rejected: string[] } {
  const next: Record<string, unknown> = { ...draft };
  const rejected: string[] = [];
  if (!patch || typeof patch !== "object") return { draft, rejected: ["(the changes were not an object)"] };
  for (const [key, raw] of Object.entries(patch as Record<string, unknown>)) {
    if (!(KEYS as string[]).includes(key)) {
      rejected.push(key);
      continue;
    }
    if (raw === null || (typeof raw === "string" && raw.trim() === "")) {
      delete next[key];
      continue;
    }
    const value = CLEAN[key as DraftKey](raw);
    if (value === undefined) rejected.push(key);
    else next[key] = value;
  }
  return { draft: next as Draft, rejected };
}

/**
 * A phone number as typed ("+31 6 1234 5678", "0031612345678", "06 1234 5678", "+44 7911 123456") as the country code and the
 * number the form stores them as. The code is the longest one we offer that the number starts with; a number with no code is
 * taken as Dutch, like the form's own default.
 */
export function splitPhone(raw: string): { country: string; number: string } {
  const typed = raw.trim();
  const international = /^(\+|00)/.test(typed);
  if (international) {
    const digits = typed.replace(/^(\+|00)/, "").replace(/\D/g, "");
    const code = COUNTRY_CODES.map(([c]) => c as string)
      .filter((c) => digits.startsWith(c))
      .sort((a, b) => b.length - a.length)[0];
    if (code) return { country: code, number: cleanPhoneInput(digits.slice(code.length), code) };
    // A code we do not offer: kept whole, so the server refuses it and says so, rather than storing a different number
    return { country: "", number: typed };
  }
  return { country: "31", number: cleanPhoneInput(typed, "31") };
}

/** Draft fields as the model and the visitor know them, for each field the form's schema can complain about. */
const FIELD_OF: Record<string, DraftKey> = {
  collection: "from",
  destination: "to",
  pickupAt: "at",
  returnAt: "ret",
  durationHours: "hours",
  passengers: "passengers",
  luggage: "bags",
  flightNumber: "flight",
  name: "name",
  email: "email",
  phoneCountry: "phone",
  phone: "phone",
  passengerName: "passengerName",
  passengerPhone: "passengerPhone",
  passengerPhoneCountry: "passengerPhone",
  notes: "notes",
  vehicle: "vehicle",
  service: "mode",
};

export function tripOf(draft: Draft): Trip {
  const trip = emptyTrip();
  trip.mode = draft.mode ?? "oneway";
  trip.from = { text: draft.from ?? "", id: null, kind: draft.fromKind ?? null };
  trip.to = { text: trip.mode === "oneway" ? (draft.to ?? "") : "", id: null, kind: draft.toKind ?? null };
  trip.stops = trip.mode === "oneway" ? (draft.stops ?? []) : [];
  trip.hours = trip.mode === "hourly" ? (draft.hours ?? "") : "";
  trip.at = draft.at ?? "";
  trip.ret = draft.ret ?? "";
  trip.pax = draft.passengers ?? 1;
  trip.bags = draft.bags ?? 0;
  trip.guestsSet = draft.passengers !== undefined;
  trip.flight = draft.flight ?? "";
  trip.vehicle = (draft.vehicle as Trip["vehicle"] | undefined) ?? "advise";
  return trip;
}

/** What the visitor sees on the card, in plain values the page can label. */
export type Summary = {
  mode: "oneway" | "hourly";
  from: string;
  to: string;
  stops: { place: string; wait: number }[];
  hours: number | null;
  when: string;
  returning: string | null;
  passengers: number;
  bags: number;
  car: string | null;
  flight: string | null;
  name: string;
  email: string;
  phone: string;
  passengerName: string | null;
  passengerPhone: string | null;
  notes: string | null;
};

export type Assessment = {
  /** Fields still to ask for, in the order to ask */
  missing: DraftKey[];
  /** Fields that have a value the booking form would turn down, with its message in the visitor's language */
  errors: Partial<Record<DraftKey, string>>;
  ready: boolean;
  /** When ready: the fields the booking form posts, as name/value pairs (a name can repeat, for the stops) */
  form?: [string, string][];
  summary?: Summary;
};

/** "Tuesday 27 October 2026 at 14:05": the wall-clock text read as it is, in the visitor's language. */
export function whenLabel(wallClock: string, locale: Locale) {
  const date = new Date(`${wallClock}:00Z`);
  if (Number.isNaN(date.getTime())) return wallClock;
  return new Intl.DateTimeFormat(locale === "nl" ? "nl-NL" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(date);
}

/** Today in the Netherlands, for the model to turn "tomorrow at nine" into a date. */
export function todayLabel() {
  const now = amsterdamNow();
  return `${whenLabel(now, "en")} (Netherlands time, ${now.replace("T", " ")})`;
}

/**
 * The cars the team has switched off, which the booking form does not offer (the same rule as /api/vehicles/unavailable).
 * If the table cannot be read nothing is hidden, as there.
 */
export async function unavailableVehicleKeys(): Promise<ReadonlySet<string>> {
  try {
    const rows = await db.select({ id: vehicles.id }).from(vehicles).where(ne(vehicles.status, "available"));
    return new Set(rows.map((r) => normalizeVehicleKey(r.id) ?? r.id));
  } catch (error) {
    console.error("Failed to read vehicle availability:", error);
    return new Set();
  }
}

/** The draft as the model is shown it: long texts shortened, so a pasted wall of text cannot fill its page. */
export const forModel = (draft: Draft): Record<string, unknown> =>
  Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, typeof v === "string" && v.length > 300 ? `${v.slice(0, 300)}…` : v]));

export function assess(draft: Draft, messages: QuoteMessages, locale: Locale, unavailable: ReadonlySet<string> = new Set()): Assessment {
  const mode = draft.mode ?? "oneway";
  const missing: DraftKey[] = [];
  if (!draft.from) missing.push("from");
  if (mode === "oneway" && !draft.to) missing.push("to");
  if (mode === "hourly" && !draft.hours) missing.push("hours");
  if (!draft.at) missing.push("at");
  if (draft.passengers === undefined) missing.push("passengers");
  if (!draft.name) missing.push("name");
  if (!draft.email) missing.push("email");
  if (!draft.phone) missing.push("phone");
  // A number for the person travelling means nothing without their name (the form asks for the name first)
  if (draft.passengerPhone && !draft.passengerName) missing.push("passengerName");

  const trip = tripOf(draft);
  const phone = draft.phone ? splitPhone(draft.phone) : null;
  const passengerPhone = draft.passengerPhone ? splitPhone(draft.passengerPhone) : null;
  const purpose = draft.purpose ?? "business";
  const form: [string, string][] = [
    ...tripFields(trip, purpose),
    ["name", draft.name ?? ""],
    ["email", draft.email ?? ""],
    ["phoneCountry", phone?.country ?? "31"],
    ["phone", phone?.number ?? ""],
    ["notes", draft.notes ?? ""],
    ["locale", locale],
  ];
  if (draft.passengerName) {
    form.push(["passengerName", draft.passengerName]);
    if (passengerPhone) form.push(["passengerPhoneCountry", passengerPhone.country || phone?.country || "31"], ["passengerPhone", passengerPhone.number]);
  }

  // The same checks the form's server action makes. Only what the visitor has already given is reported as wrong; what is
  // not given yet is "missing", which the model asks for in its own way.
  const values: Record<string, unknown> = {};
  for (const [k, v] of form) values[k] = v;
  const parsed = quoteSchema(messages).safeParse({ ...values, passengers: values.passengers || undefined, vehicle: values.vehicle || undefined, notes: values.notes || undefined });
  const errors: Partial<Record<DraftKey, string>> = {};
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const key = FIELD_OF[String(issue.path[0])];
      if (key && draft[key] !== undefined && !(key in errors)) errors[key] = issue.message;
    }
  }
  if (phone && !phone.country && !errors.phone) errors.phone = messages.phoneCountryInvalid;
  if (draft.vehicle && unavailable.has(draft.vehicle)) errors.vehicle = "That car is not available at the moment: offer another, or no preference.";

  const ready = missing.length === 0 && parsed.success && Object.keys(errors).length === 0;
  if (!ready) return { missing, errors, ready: false };

  const car = draft.vehicle && draft.vehicle !== "advise" ? (FLEET.find((v) => v.key === draft.vehicle)?.name ?? null) : null;
  const national = (p: { country: string; number: string } | null, fallback: string) => (p ? `+${p.country || fallback} ${p.number}` : "");
  return {
    missing,
    errors,
    ready: true,
    form,
    summary: {
      mode,
      from: draft.from!,
      to: mode === "oneway" ? draft.to! : "",
      stops: mode === "oneway" ? (draft.stops ?? []) : [],
      hours: mode === "hourly" ? draft.hours! : null,
      when: whenLabel(draft.at!, locale),
      returning: draft.ret ? whenLabel(draft.ret, locale) : null,
      passengers: draft.passengers!,
      bags: draft.bags ?? 0,
      car,
      flight: draft.flight && form.some(([k, v]) => k === "flightNumber" && v) ? draft.flight : null,
      name: draft.name!,
      email: draft.email!,
      phone: national(phone, "31"),
      passengerName: draft.passengerName ?? null,
      passengerPhone: draft.passengerName && passengerPhone ? national(passengerPhone, phone?.country ?? "31") : null,
      notes: draft.notes ?? null,
    },
  };
}
