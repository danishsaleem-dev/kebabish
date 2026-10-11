import "server-only";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { LOGO_HEIGHT, LOGO_PNG_BASE64, LOGO_WIDTH } from "@/lib/invoice/logo";

/**
 * The invoice as a PDF — one document a customer can keep, and the same one
 * staff can send by hand for an order that has no email address.
 *
 * Drawn directly with pdf-lib (pure JavaScript, no fonts or files read at
 * runtime), because that is what runs reliably in a serverless function. The
 * built-in Helvetica covers Dutch and English completely (including the euro
 * sign); a character outside it — a name in another script, say — is
 * transliterated where possible and shown as "?" otherwise rather than
 * crashing the whole invoice.
 */

export type InvoiceLocale = "nl" | "en";

export interface InvoiceData {
  locale: InvoiceLocale;
  invoiceNumber: string;
  /** When the payment was received — the invoice date. */
  invoiceDate: Date;
  /** The order reference, kept separate from the invoice number. */
  reference: string;
  seller: {
    /** Printed when the owner chooses to show the registered company name. */
    legalName: string | null;
    tradeName: string;
    addressLines: string[];
    kvk: string;
    vatId: string | null;
    email: string;
    phone: string;
    iban: string;
    bic: string;
  };
  customer: {
    name: string;
    addressLines: string[];
    email: string;
    phone: string;
  };
  lines: {
    name: string;
    quantity: number;
    unitCents: number;
    totalCents: number;
    /** Chosen extras, and the customer's note for this dish. */
    details: string[];
  }[];
  subtotalCents: number;
  discountCents: number;
  promoCode: string | null;
  deliveryFeeCents: number;
  totalCents: number;
  /** VAT percentage included in the prices, or null if the owner hasn't set one. */
  vatRate: number | null;
  vatCents: number | null;
  paymentMethod: "mollie" | "cash" | "bank_transfer" | "unpaid" | "payment_link";
  paidAt: Date | null;
  /**
   * Present only when this document is a CREDIT NOTE rather than an invoice.
   * Everything else is then filled in as the (negative) correction: one line,
   * a negative total, the VAT inside the refund. The invoice itself never
   * carries refund information — it stays as it was issued.
   */
  creditNote?: {
    number: string;
    /** The invoice this corrects. */
    invoiceNumber: string;
    /** Shown only when staff chose to give the customer a reason. */
    reason: string | null;
    /** Did the money go back through Mollie, or did a person hand it back? */
    viaMollie: boolean;
  };
  delivery: {
    /** "YYYY-MM-DD", or null when no slot was booked. */
    date: string | null;
    slotStart: string | null;
    slotEnd: string | null;
  };
}

const COPY = {
  nl: {
    title: "FACTUUR",
    invoiceNumber: "Factuurnummer",
    invoiceDate: "Factuurdatum",
    orderNumber: "Bestelnummer",
    deliveryDate: "Leverdatum",
    billedTo: "Factuur voor",
    from: "Van",
    description: "Omschrijving",
    qty: "Aantal",
    price: "Prijs",
    amount: "Bedrag",
    subtotal: "Subtotaal",
    discount: "Korting",
    delivery: "Bezorgkosten",
    free: "Gratis",
    total: "Totaal (incl. btw)",
    vatTitle: "Btw-specificatie",
    vatBase: "Bedrag excl. btw",
    vatRate: "Btw-tarief",
    vatAmount: "Btw",
    vatNote: "Alle prijzen zijn inclusief btw.",
    payment: "Betaling",
    paidOnline: "Betaald online",
    paidCash: "Contant betaald",
    paidBank: "Betaald per bankoverschrijving",
    unpaid: "Nog niet betaald",
    on: "op",
    kvk: "KVK",
    vatId: "BTW-id",
    iban: "IBAN",
    bic: "BIC",
    creditTitle: "CREDITNOTA",
    creditNumber: "Creditnotanummer",
    creditDate: "Datum",
    concerningInvoice: "Betreft factuur",
    creditedTotal: "Totaal gecrediteerd (incl. btw)",
    refundedOn: "Terugbetaald op",
    refundedViaMollie: "Teruggestort naar de betaalmethode van de oorspronkelijke betaling.",
    refundedByUs: "Door ons terugbetaald.",
    reasonLabel: "Reden",
    deliveryTime: "Bezorgmoment",
    between: "tussen",
    and: "en",
    footer: "Vragen over deze factuur? Mail of bel ons — de gegevens staan hierboven.",
    dateLocale: "nl-NL",
    decimal: ",",
  },
  en: {
    title: "INVOICE",
    invoiceNumber: "Invoice number",
    invoiceDate: "Invoice date",
    orderNumber: "Order number",
    deliveryDate: "Supply date",
    billedTo: "Billed to",
    from: "From",
    description: "Description",
    qty: "Qty",
    price: "Price",
    amount: "Amount",
    subtotal: "Subtotal",
    discount: "Discount",
    delivery: "Delivery",
    free: "Free",
    total: "Total (incl. VAT)",
    vatTitle: "VAT breakdown",
    vatBase: "Amount excl. VAT",
    vatRate: "VAT rate",
    vatAmount: "VAT",
    vatNote: "All prices include VAT.",
    payment: "Payment",
    paidOnline: "Paid online",
    paidCash: "Paid in cash",
    paidBank: "Paid by bank transfer",
    unpaid: "Not yet paid",
    on: "on",
    kvk: "KVK",
    vatId: "VAT ID",
    iban: "IBAN",
    bic: "BIC",
    creditTitle: "CREDIT NOTE",
    creditNumber: "Credit note number",
    creditDate: "Date",
    concerningInvoice: "Relates to invoice",
    creditedTotal: "Total credited (incl. VAT)",
    refundedOn: "Refunded on",
    refundedViaMollie: "Refunded to the payment method used for the original payment.",
    refundedByUs: "Refunded by us directly.",
    reasonLabel: "Reason",
    deliveryTime: "Delivery time",
    between: "between",
    and: "and",
    footer: "Questions about this invoice? Email or call us — the details are above.",
    dateLocale: "en-GB",
    decimal: ".",
  },
} as const;

const PAGE_W = 595.28; // A4, points
const PAGE_H = 841.89;
const MARGIN = 48;
const CHARCOAL = rgb(0.24, 0.22, 0.19);
const EMBER = rgb(0.66, 0.31, 0.15);
const MUTED = rgb(0.45, 0.42, 0.38);
const HAIRLINE = rgb(0.85, 0.82, 0.76);

export async function buildInvoicePdf(data: InvoiceData): Promise<Uint8Array> {
  const c = COPY[data.locale];
  const pdf = await PDFDocument.create();
  pdf.setTitle(
    data.creditNote
      ? `${c.creditTitle} ${data.creditNote.number}`
      : `${c.title} ${data.invoiceNumber}`
  );
  pdf.setAuthor(data.seller.tradeName);
  pdf.setSubject(`${c.orderNumber} ${data.reference}`);
  pdf.setCreator(data.seller.tradeName);

  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await pdf.embedPng(Buffer.from(LOGO_PNG_BASE64, "base64"));

  const supported = new Set(regular.getCharacterSet());
  /** Make any string safe for the built-in font. */
  const safe = (text: string): string => {
    let out = "";
    for (const ch of text.replace(/[\r\n\t]+/g, " ")) {
      if (supported.has(ch.codePointAt(0)!)) {
        out += ch;
        continue;
      }
      // Letters Unicode can't decompose into base + accent, but that have an
      // obvious plain equivalent.
      const plain: Record<string, string> = { "Ł": "L", "ł": "l", "Đ": "D", "đ": "d", "Ħ": "H", "ħ": "h", "ı": "i" };
      const base = plain[ch] ?? ch.normalize("NFKD").replace(/[̀-ͯ]/g, "");
      out += base && [...base].every((b) => supported.has(b.codePointAt(0)!)) ? base : "?";
    }
    return out;
  };

  const money = (cents: number) =>
    `${cents < 0 ? "-" : ""}€ ${(Math.abs(cents) / 100).toFixed(2).replace(".", c.decimal)}`;
  const credit = data.creditNote;
  const date = (d: Date) =>
    new Intl.DateTimeFormat(c.dateLocale, {
      timeZone: "Europe/Amsterdam",
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(d);
  const dateFromKey = (key: string) => {
    const [y, m, day] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(c.dateLocale, { day: "numeric", month: "long", year: "numeric" }).format(
      new Date(y, m - 1, day)
    );
  };

  let page: PDFPage = pdf.addPage([PAGE_W, PAGE_H]);
  let y = PAGE_H - MARGIN;

  const text = (
    s: string,
    x: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}
  ) =>
    page.drawText(safe(s), {
      x,
      y: yy,
      font: opts.font ?? regular,
      size: opts.size ?? 10,
      color: opts.color ?? CHARCOAL,
    });
  const textRight = (
    s: string,
    xRight: number,
    yy: number,
    opts: { font?: PDFFont; size?: number; color?: ReturnType<typeof rgb> } = {}
  ) => {
    const font = opts.font ?? regular;
    const size = opts.size ?? 10;
    text(s, xRight - font.widthOfTextAtSize(safe(s), size), yy, opts);
  };
  const rule = (yy: number, color = HAIRLINE) =>
    page.drawLine({
      start: { x: MARGIN, y: yy },
      end: { x: PAGE_W - MARGIN, y: yy },
      thickness: 0.7,
      color,
    });
  /** Word-wrap `s` to `width`, returning the lines. */
  const wrap = (s: string, font: PDFFont, size: number, width: number): string[] => {
    const words = safe(s).split(" ");
    const lines: string[] = [];
    let current = "";
    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(trial, size) <= width) {
        current = trial;
      } else {
        if (current) lines.push(current);
        // A single word longer than the column: hard-split it.
        let rest = word;
        while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        current = rest;
      }
    }
    if (current) lines.push(current);
    return lines.length ? lines : [""];
  };
  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN + 40) {
      page = pdf.addPage([PAGE_W, PAGE_H]);
      y = PAGE_H - MARGIN;
    }
  };

  // ------------------------------------------------------------ header
  const logoW = 120;
  const logoH = (logoW * LOGO_HEIGHT) / LOGO_WIDTH;
  page.drawImage(logo, { x: MARGIN, y: y - logoH, width: logoW, height: logoH });

  const rightX = PAGE_W - MARGIN;
  textRight(credit ? c.creditTitle : c.title, rightX, y - 18, { font: bold, size: 22, color: EMBER });
  const meta: [string, string][] = credit
    ? [
        [c.creditNumber, credit.number],
        [c.creditDate, date(data.invoiceDate)],
        [c.concerningInvoice, credit.invoiceNumber],
        [c.orderNumber, data.reference],
      ]
    : [
        [c.invoiceNumber, data.invoiceNumber],
        [c.invoiceDate, date(data.invoiceDate)],
        [c.orderNumber, data.reference],
      ];
  if (!credit && data.delivery.date) meta.push([c.deliveryDate, dateFromKey(data.delivery.date)]);
  let my = y - 40;
  for (const [label, value] of meta) {
    textRight(value, rightX, my, { font: bold, size: 9.5 });
    textRight(`${label}:`, rightX - bold.widthOfTextAtSize(safe(value), 9.5) - 6, my, {
      size: 9.5,
      color: MUTED,
    });
    my -= 14;
  }
  y = Math.min(y - logoH, my) - 26;

  // ------------------------------------------------------------ parties
  const colW = (PAGE_W - 2 * MARGIN - 24) / 2;
  const partyTop = y;
  const drawParty = (title: string, x: number, rows: { text: string; strong?: boolean }[]) => {
    text(title.toUpperCase(), x, partyTop, { font: bold, size: 8, color: MUTED });
    let py = partyTop - 14;
    for (const row of rows) {
      for (const line of wrap(row.text, row.strong ? bold : regular, 10, colW)) {
        text(line, x, py, { font: row.strong ? bold : regular });
        py -= 13;
      }
    }
    return py;
  };

  const sellerRows = [
    { text: data.seller.legalName ? `${data.seller.tradeName} — ${data.seller.legalName}` : data.seller.tradeName, strong: true },
    ...data.seller.addressLines.map((t) => ({ text: t })),
    { text: `${c.kvk} ${data.seller.kvk}${data.seller.vatId ? `  ·  ${c.vatId} ${data.seller.vatId}` : ""}` },
    { text: data.seller.email },
    { text: data.seller.phone },
  ];
  const customerRows = [
    { text: data.customer.name, strong: true },
    ...data.customer.addressLines.map((t) => ({ text: t })),
    ...(data.customer.email ? [{ text: data.customer.email }] : []),
    { text: data.customer.phone },
  ];
  const a = drawParty(c.from, MARGIN, sellerRows);
  const b = drawParty(c.billedTo, MARGIN + colW + 24, customerRows);
  y = Math.min(a, b) - 18;

  // ------------------------------------------------------------ line table
  const xQty = PAGE_W - MARGIN - 190;
  const xPrice = PAGE_W - MARGIN - 105;
  const xAmount = PAGE_W - MARGIN;
  const descW = xQty - MARGIN - 28;

  const drawTableHead = () => {
    page.drawRectangle({ x: MARGIN, y: y - 6, width: PAGE_W - 2 * MARGIN, height: 22, color: rgb(0.96, 0.94, 0.89) });
    text(c.description, MARGIN + 8, y + 1, { font: bold, size: 9 });
    textRight(c.qty, xQty + 14, y + 1, { font: bold, size: 9 });
    textRight(c.price, xPrice, y + 1, { font: bold, size: 9 });
    textRight(c.amount, xAmount - 8, y + 1, { font: bold, size: 9 });
    y -= 26;
  };
  drawTableHead();

  for (const line of data.lines) {
    const nameLines = wrap(line.name, bold, 10, descW);
    const detailLines = line.details.flatMap((d) => wrap(d, regular, 8.5, descW));
    const height = nameLines.length * 13 + detailLines.length * 11 + 10;
    if (y - height < MARGIN + 40) {
      ensureSpace(height + 40);
      drawTableHead();
    }
    let ly = y;
    for (const n of nameLines) {
      text(n, MARGIN + 8, ly, { font: bold });
      ly -= 13;
    }
    for (const d of detailLines) {
      text(d, MARGIN + 8, ly, { size: 8.5, color: MUTED });
      ly -= 11;
    }
    textRight(String(line.quantity), xQty + 14, y);
    textRight(money(line.unitCents), xPrice, y);
    textRight(money(line.totalCents), xAmount - 8, y);
    y = ly - 4;
    rule(y + 2);
    y -= 8;
  }

  // ------------------------------------------------------------ totals
  ensureSpace(190);
  y -= 6;
  const labelX = PAGE_W - MARGIN - 230;
  const totalRow = (label: string, value: string, strong = false) => {
    text(label, labelX, y, { font: strong ? bold : regular, size: strong ? 11 : 10 });
    textRight(value, xAmount - 8, y, { font: strong ? bold : regular, size: strong ? 11 : 10 });
    y -= strong ? 18 : 15;
  };
  if (!credit) {
    totalRow(c.subtotal, money(data.subtotalCents));
    if (data.discountCents > 0) {
      totalRow(`${c.discount}${data.promoCode ? ` (${data.promoCode})` : ""}`, `-${money(data.discountCents)}`);
    }
    totalRow(c.delivery, data.deliveryFeeCents === 0 ? c.free : money(data.deliveryFeeCents));
  }
  rule(y + 8, CHARCOAL);
  y -= 4;
  totalRow(credit ? c.creditedTotal : c.total, money(data.totalCents), true);

  // ------------------------------------------------------------ VAT
  y -= 6;
  text(c.vatTitle.toUpperCase(), MARGIN, y, { font: bold, size: 8, color: MUTED });
  y -= 14;
  if (data.vatRate != null && data.vatCents != null) {
    const base = data.totalCents - data.vatCents;
    text(`${c.vatBase}: ${money(base)}`, MARGIN, y);
    text(`${c.vatRate}: ${String(data.vatRate).replace(".", c.decimal)}%`, MARGIN + 190, y);
    text(`${c.vatAmount}: ${money(data.vatCents)}`, MARGIN + 330, y);
    y -= 14;
  }
  text(c.vatNote, MARGIN, y, { size: 9, color: MUTED });
  y -= 24;

  // ------------------------------------------------------------ payment + delivery
  ensureSpace(110);
  text(c.payment.toUpperCase(), MARGIN, y, { font: bold, size: 8, color: MUTED });
  y -= 14;
  if (credit) {
    text(`${c.refundedOn} ${date(data.invoiceDate)}`, MARGIN, y, { font: bold });
    y -= 14;
    text(credit.viaMollie ? c.refundedViaMollie : c.refundedByUs, MARGIN, y);
    y -= 14;
    if (credit.reason) {
      for (const line of wrap(`${c.reasonLabel}: ${credit.reason}`, regular, 10, PAGE_W - 2 * MARGIN)) {
        text(line, MARGIN, y);
        y -= 13;
      }
    }
  } else {
    const when = data.paidAt ? ` ${c.on} ${date(data.paidAt)}` : "";
    const paymentLabel =
      data.paidAt == null
        ? c.unpaid
        : data.paymentMethod === "cash"
          ? c.paidCash
          : data.paymentMethod === "bank_transfer"
            ? c.paidBank
            : c.paidOnline;
    text(`${paymentLabel}${when}`, MARGIN, y);
    y -= 14;
    if (data.delivery.date && data.delivery.slotStart && data.delivery.slotEnd) {
      text(
        `${c.deliveryTime}: ${dateFromKey(data.delivery.date)}, ${c.between} ${data.delivery.slotStart} ${c.and} ${data.delivery.slotEnd}`,
        MARGIN,
        y
      );
      y -= 14;
    }
  }

  // ------------------------------------------------------------ footer on every page
  const pages = pdf.getPages();
  pages.forEach((p, i) => {
    const fy = MARGIN - 8;
    p.drawLine({ start: { x: MARGIN, y: fy + 24 }, end: { x: PAGE_W - MARGIN, y: fy + 24 }, thickness: 0.7, color: HAIRLINE });
    const bank = `${c.iban} ${data.seller.iban}  ·  ${c.bic} ${data.seller.bic}`;
    p.drawText(safe(`${data.seller.tradeName}  ·  ${c.kvk} ${data.seller.kvk}${data.seller.vatId ? `  ·  ${c.vatId} ${data.seller.vatId}` : ""}  ·  ${bank}`), {
      x: MARGIN, y: fy + 10, size: 8, font: regular, color: MUTED,
    });
    p.drawText(safe(c.footer), { x: MARGIN, y: fy - 2, size: 8, font: regular, color: MUTED });
    if (pages.length > 1) {
      const label = `${i + 1} / ${pages.length}`;
      p.drawText(label, { x: PAGE_W - MARGIN - regular.widthOfTextAtSize(label, 8), y: fy - 2, size: 8, font: regular, color: MUTED });
    }
  });

  return pdf.save();
}

/** A credit note is the same document with the credit-note fields filled in. */
export const buildCreditNotePdf = buildInvoicePdf;
