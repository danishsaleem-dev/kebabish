/**
 * Turn a phone number as a customer typed it ("06 84011572", "+31 6 …",
 * "0031 …") into the digits-only international form wa.me wants
 * ("31684011572"). A leading 0 is read as a Dutch national number — the
 * business only delivers locally.
 */
export function whatsappDigits(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits.slice(1).replace(/\D/g, "");
  const plain = digits.replace(/\D/g, "");
  if (plain.startsWith("00")) return plain.slice(2);
  if (plain.startsWith("0")) return `31${plain.slice(1)}`;
  return plain;
}

/** A `tel:` href — keeps a leading + but drops spaces and punctuation. */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Turn-by-turn navigation to an address, no API key needed. */
export function mapsDirectionsHref(address: string): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(address)}`;
}

/**
 * Validate a Dutch phone number and return it in E.164 ("+31612345678"), or
 * null if it isn't one. Accepts national ("06 12345678", "020-1234567"),
 * "+31 …", "0031 …" and the "+31 (0)6 …" habit. A Dutch number is 9 digits
 * after the country code; the first is 1–8 (mobile 6, landline 1–5/7, VoIP/
 * business 8). 09xx premium-rate numbers are rejected.
 */
export function normalizeDutchPhone(input: string): string | null {
  let s = input.trim();
  if (!/^[+\d][\d\s().\-]*$/.test(s)) return null;
  s = s.replace(/\(0\)/g, "");
  let digits = s.replace(/\D/g, "");
  if (s.startsWith("+")) {
    if (!digits.startsWith("31")) return null;
    digits = digits.slice(2);
  } else if (digits.startsWith("0031")) {
    digits = digits.slice(4);
  } else if (digits.startsWith("0")) {
    digits = digits.slice(1);
  } else {
    return null;
  }
  return /^[1-8]\d{8}$/.test(digits) ? `+31${digits}` : null;
}
