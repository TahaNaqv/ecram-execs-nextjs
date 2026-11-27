import type { Draft } from "@/lib/concierge/booking";
import { MAX_BAGS, MAX_PASSENGERS } from "@/app/[locale]/_components/booking/trip";

export type PartyBits = {
  passengers?: number;
  bags?: number;
  phone?: string;
  name?: string;
  email?: string;
};

const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const ALONE =
  /\b(?:i am|i'm|im)?\s*(?:travell?ing|traling|traveling)\s+alone\b|\b(?:just me|only me|by myself|on my own|solo)\b|\balone\b/i;
const PAX =
  /\b(\d{1,2})\s*(?:passengers?|passngers?|passangers?|persons?|percons?|people|pax)\b/i;
const BAGS = /\b(\d{1,2})\s*(?:large\s+)?(?:bags?|suitcases?|luggage)\b/i;
const NO_BAGS = /\b(?:no|zero|none|0)\s+(?:large\s+)?(?:bags?|suitcases?|luggage)\b/i;
const NAME = /\b(?:my name is|i am called|name is|this is)\s+([A-Za-z][A-Za-z'’. -]{1,80})/i;
const PHONE = /(?:\+|00)\d[\d\s().-]{6,}\d|\b0\d[\d\s().-]{7,}\d\b/;

const clamp = (n: number, min: number, max: number) => (Number.isInteger(n) && n >= min && n <= max ? n : undefined);

/**
 * Passengers, large bags and a phone from one message, including a comma list ("1, 2, 0335935557")
 * and short phrases ("1 person only", "1 percon", "i am traling alone").
 */
export function readPartyDetails(message: string): PartyBits {
  const text = message.trim();
  const out: PartyBits = {};
  const email = text.match(EMAIL)?.[0];
  if (email) out.email = email.toLowerCase();
  const named = text.match(NAME)?.[1]?.replace(/[.,!?]+$/, "").trim();
  if (named && named.length > 1 && !/\b(?:travell?ing|traling|traveling|alone)\b/i.test(named)) out.name = named.replace(/\s+/g, " ");

  const csv = text.match(/^\s*(\d{1,2})\s*,\s*(\d{1,2})\s*,\s*([+\d][\d\s().-]{6,}\d)\s*$/);
  if (csv) {
    const passengers = clamp(Number(csv[1]), 1, MAX_PASSENGERS);
    const bags = clamp(Number(csv[2]), 0, MAX_BAGS);
    if (passengers !== undefined) out.passengers = passengers;
    if (bags !== undefined) out.bags = bags;
    out.phone = csv[3].trim();
    return out;
  }
  const pair = text.match(/^\s*(\d{1,2})\s*,\s*(\d{1,2})\s*$/);
  if (pair) {
    const passengers = clamp(Number(pair[1]), 1, MAX_PASSENGERS);
    const bags = clamp(Number(pair[2]), 0, MAX_BAGS);
    if (passengers !== undefined) out.passengers = passengers;
    if (bags !== undefined) out.bags = bags;
    return out;
  }

  const together = text.match(
    /\b(\d{1,2})\s*(?:passengers?|passngers?|passangers?|persons?|percons?|people|pax)\s*,?\s*(?:and\s+|with\s+)?(\d{1,2})\s*(?:large\s+)?(?:bags?|suitcases?|luggage)\b/i,
  );
  if (together) {
    const passengers = clamp(Number(together[1]), 1, MAX_PASSENGERS);
    const bags = clamp(Number(together[2]), 0, MAX_BAGS);
    if (passengers !== undefined) out.passengers = passengers;
    if (bags !== undefined) out.bags = bags;
  }

  const passengers = out.passengers ?? clamp(Number(text.match(PAX)?.[1]), 1, MAX_PASSENGERS);
  if (passengers !== undefined) out.passengers = passengers;
  else if (ALONE.test(text) || /\b1\s+(?:percon|person)\s+only\b/i.test(text)) out.passengers = 1;

  if (!out.phone) {
    const bare = text.match(/\b(\d{8,15})\b/);
    if (bare) out.phone = bare[1];
  }

  if (NO_BAGS.test(text)) out.bags = 0;
  else {
    const bags = clamp(Number(text.match(BAGS)?.[1]), 0, MAX_BAGS);
    if (bags !== undefined) out.bags = bags;
  }

  const phone = text.match(PHONE)?.[0]?.trim();
  if (phone && phone.replace(/\D/g, "").length >= 8) out.phone = phone;
  return out;
}

/** Fills only the party and contact fields the draft does not have yet. */
export function absorbParty(draft: Draft, message: string): Draft {
  const bits = readPartyDetails(message);
  const next: Draft = { ...draft };
  if (next.passengers === undefined && bits.passengers !== undefined) next.passengers = bits.passengers;
  if (next.bags === undefined && bits.bags !== undefined) next.bags = bits.bags;
  if (!next.phone && bits.phone) next.phone = bits.phone;
  if (!next.name && bits.name) next.name = bits.name;
  if (!next.email && bits.email) next.email = bits.email;
  return next;
}

const FOLLOW =
  /\b(call\s*me(?:\s*back)?|callback|ring me|quote|custom(?:\s+arrangement)?|bespoke|whatsapp|speak to (?:a |the )?(?:person|human|someone|team)|reservations team)\b/i;

/** A callback, a quote, a custom arrangement, a hand-off, or contact details that are only partly there. */
export function needsFollowUp(message: string, draft: Record<string, unknown>, handoff = false): boolean {
  if (handoff || FOLLOW.test(message)) return true;
  const bits = readPartyDetails(message);
  const name = typeof draft.name === "string" && draft.name.trim();
  const email = typeof draft.email === "string" && draft.email.includes("@");
  const phone = typeof draft.phone === "string" && draft.phone.replace(/\D/g, "").length >= 8;
  const started = Boolean(name || email || phone || bits.passengers != null || bits.bags != null || bits.phone);
  if (!started) return false;
  return !name || !email || !phone;
}
