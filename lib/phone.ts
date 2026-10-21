/**
 * How long a phone number may be. The country code is chosen separately, so these count only the digits typed after it,
 * including the 0 many people still put in front (the UK's 07911 123456 and Pakistan's 0300 1234567 are 11 digits; a
 * Dutch mobile is 9 without the 0 and 10 with it). Countries not listed here get the general range: the shortest real
 * numbers are about 6 digits and the international standard (E.164) allows 15 in all, of which the country code is part.
 * Shared by the forms (to stop typing at the limit) and by the server (to check what arrives).
 */
export function phoneDigitLimits(countryCode: string): { min: number; max: number } {
  switch (countryCode.replace(/^\+/, "")) {
    case "1": // US / Canada
      return { min: 10, max: 10 };
    case "31": // Netherlands
      return { min: 9, max: 10 };
    case "44": // United Kingdom
    case "92": // Pakistan
      return { min: 9, max: 11 };
    default:
      return { min: 6, max: 15 };
  }
}

export const digitsOnly = (value: string) => value.replace(/\D/g, "");

/** True when the number has a plausible number of digits for the country. */
export function phoneLengthOk(countryCode: string, number: string): boolean {
  const { min, max } = phoneDigitLimits(countryCode);
  const length = digitsOnly(number).length;
  return length >= min && length <= max;
}

/**
 * What a phone box should hold after the visitor typed or pasted into it: digits only, cut to the country's limit.
 * The country code is chosen separately, so one typed or pasted along with the number is taken off first, so the limit
 * cuts nothing off the number itself: "+31 6 1234 5678" and "0031 6 …" with the Netherlands selected, and "31612345678" or
 * (United States) "12125550100", which are too long to be a national number and begin with the code. A number that
 * starts with "+" or "00" and another country's code is left exactly as written: cutting it short would store a
 * different number without a word, while the server turns it down and says so.
 */
export function cleanPhoneInput(raw: string, countryCode: string): string {
  const code = countryCode.replace(/^\+/, "");
  const { min, max } = phoneDigitLimits(code);
  const trimmed = raw.trim();
  let digits = digitsOnly(trimmed);
  if (/^(\+|00)/.test(trimmed)) {
    digits = digitsOnly(trimmed.replace(/^(\+|00)/, ""));
    if (!digits.startsWith(code)) return trimmed;
    digits = digits.slice(code.length);
  } else if (digits.length > max && digits.startsWith(code)) {
    const rest = digits.slice(code.length);
    if (rest.length >= min && rest.length <= max) digits = rest;
  }
  return digits.slice(0, max);
}

/**
 * The most characters a phone box accepts before cleaning. Not the digit limit itself: a browser cuts a paste to a box's
 * maxLength before the page sees it, and a number pasted with its country code and spaces is longer than its digits.
 * The digit limit is applied by `cleanPhoneInput` as the visitor types.
 */
export const PASTE_MAX = 24;
