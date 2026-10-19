/**
 * Orders store an address as one line — "Overstoep 49 A, 1616RK Hoogkarspel" — but the manual-order form
 * has separate boxes for street, house number, addition, postcode and town. This turns a stored line back
 * into those parts so picking a returning customer can fill the form. Pure, and forgiving: it only has to
 * give staff a head start (every box stays editable), never to be the source of truth.
 */

export interface AddressParts {
  street: string;
  houseNumber: string;
  addition: string;
  postcode: string;
  city: string;
}

/**
 * "Overstoep 49 A" → street "Overstoep", number "49", addition "A". The number is the *last* digits in
 * the line, so a street that itself starts with a number ("2e Hogeweg 12") keeps its name intact.
 */
export function splitStreet(line: string): { street: string; houseNumber: string; addition: string } {
  const text = line.trim().replace(/\s+/g, " ");
  const m = /^(.*\S)\s+(\d{1,5})(?:\s*[-/]?\s*([A-Za-z0-9][A-Za-z0-9\- ]{0,9}))?$/.exec(text);
  if (!m) return { street: text, houseNumber: "", addition: "" };
  return { street: m[1], houseNumber: m[2], addition: (m[3] ?? "").trim() };
}

/** "Street 12 A, 1616 RK Hoogkarspel" → parts, or null when it isn't an address of that shape. */
export function parseAddressLine(line: string | null | undefined): AddressParts | null {
  if (!line) return null;
  const m = /^(.+?),\s*(\d{4})\s?([A-Za-z]{2})\s+(.+)$/.exec(line.trim());
  if (!m) return null;
  const { street, houseNumber, addition } = splitStreet(m[1]);
  return { street, houseNumber, addition, postcode: `${m[2]}${m[3].toUpperCase()}`, city: m[4].trim() };
}
