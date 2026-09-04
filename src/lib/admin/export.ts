/**
 * CSV export for the admin tables.
 *
 * Exports whatever the table is currently showing — filters, search and sort
 * included — because "export" almost always means "export what I'm looking
 * at", not "export everything".
 */

export type CsvColumn<T> = {
  header: string;
  value: (row: T) => string | number;
};

/** RFC 4180 quoting: wrap in quotes and double any internal quote. */
function escapeCell(value: string | number): string {
  const str = String(value ?? "");
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(",")
  );
  return [header, ...body].join("\r\n");
}

export function downloadCsv(filename: string, csv: string): void {
  // BOM so Excel opens UTF-8 (é, €) correctly instead of mangling it.
  const blob = new Blob([`﻿${csv}`], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

/** `orders-2024-12-22.csv` */
export function stampedFilename(prefix: string): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.csv`;
}
