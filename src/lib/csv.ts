/**
 * Generatore CSV pensato per Excel in italiano:
 *  - separatore ";" e importi con la virgola decimale;
 *  - BOM UTF-8 (altrimenti gli accenti si rovinano);
 *  - protezione dalle "formule": un testo che inizia con = + - @ (o tab/CR) verrebbe
 *    eseguito da Excel come formula, quindi viene preceduto da un apostrofo.
 */

export type CsvCell = string | number | null | { cents: number };

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(cell: CsvCell): string {
  if (cell === null) return "";
  if (typeof cell === "number") return String(cell);
  if (typeof cell === "object") return formatCents(cell.cents);

  let text = cell;
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[;"\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** 1250 → "12,50"; -150 → "-1,50". */
export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.trunc(abs / 100)},${String(abs % 100).padStart(2, "0")}`;
}

export function toCsv(header: string[], rows: CsvCell[][]): string {
  const lines = [header, ...rows].map((row) =>
    row.map((c) => csvCell(c)).join(";"),
  );
  return `﻿${lines.join("\r\n")}\r\n`;
}
