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
