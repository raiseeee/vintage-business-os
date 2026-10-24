import { z } from "zod";
import { optionalEuro, optionalText, shortText } from "@/lib/validation";
import { ITEM_CONDITIONS } from "./constants";
import { conditionField } from "./schemas";

export const IMPORT_MAX_ROWS = 500;
export const IMPORT_MAX_BYTES = 900 * 1024;

/** Legge un CSV (separatore ; , o tab; virgolette; BOM; righe CRLF). Restituisce le righe di celle. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const count = (c: string) => firstLine.split(c).length - 1;
  const delimiter = count(";") >= count(",") && count(";") >= count("\t") ? ";" : count("\t") > count(",") ? "\t" : ",";

  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === delimiter) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += ch;
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

export type ImportField = "brand" | "category" | "size" | "condition" | "expected_price_cents" | "notes";

/** Nomi di colonna accettati (senza accenti, spazi o trattini bassi). */
const HEADERS: Record<string, ImportField> = {
  marca: "brand", brand: "brand", marchio: "brand",
  categoria: "category", category: "category", tipo: "category", capo: "category",
  taglia: "size", size: "size",
  condizione: "condition", condition: "condition", stato_capo: "condition",
  prezzo: "expected_price_cents", prezzoprevisto: "expected_price_cents", prezzodivenditaprevisto: "expected_price_cents",
  prezzodivendita: "expected_price_cents", price: "expected_price_cents", expectedprice: "expected_price_cents",
  note: "notes", notes: "notes", nota: "notes",
};

function normalizeHeader(h: string): string {
  return h
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[\s_\-()€.]/g, "");
}

const CONDITION_ALIASES: Record<string, (typeof ITEM_CONDITIONS)[number]> = {
  ottima: "ottima", ottimo: "ottima", buona: "buona", buono: "buona",
  discreta: "discreta", discreto: "discreta", dariparare: "da_riparare", riparare: "da_riparare",
};

const rowSchema = z.object({
  brand: shortText,
  category: shortText,
  size: shortText,
  condition: conditionField,
  expected_price_cents: optionalEuro,
  notes: optionalText,
});

export type ImportedItem = z.infer<typeof rowSchema>;

export interface ImportResult {
  items: ImportedItem[];
  /** Errori bloccanti, uno per riga (con il numero di riga del file). */
  errors: string[];
  /** Colonne del file che non sono state riconosciute (ignorate). */
  ignoredColumns: string[];
}

/**
 * Converte il testo del CSV in capi. Tutto o niente: se c'è un errore, l'importazione non parte.
 * I codici non si leggono dal file: li assegna il server (<lotto>-001, -002…).
 */
export function parseItemImport(text: string): ImportResult {
  const empty = (errors: string[]): ImportResult => ({ items: [], errors, ignoredColumns: [] });
  const table = parseCsv(text);
  if (table.length === 0 || table[0].every((c) => c.trim() === "")) return empty(["Il file è vuoto."]);

  const [header, ...body] = table;
  const map: (ImportField | null)[] = [];
  const ignored: string[] = [];
  for (const h of header) {
    const field = HEADERS[normalizeHeader(h)] ?? null;
    if (!field || map.includes(field)) {
      if (h.trim() !== "") ignored.push(h.trim());
      map.push(null);
    } else map.push(field);
  }
  if (map.every((f) => f === null)) {
    return { items: [], ignoredColumns: ignored, errors: ["Nessuna colonna riconosciuta. La prima riga deve contenere i nomi: marca, categoria, taglia, condizione, prezzo previsto, note."] };
  }

  const rows = body
    .map((cells, i) => ({ cells, line: i + 2 }))
    .filter(({ cells }) => cells.some((c) => c.trim() !== ""));
  if (rows.length === 0) return { items: [], ignoredColumns: ignored, errors: ["Il file contiene solo l'intestazione: nessun capo da importare."] };
  if (rows.length > IMPORT_MAX_ROWS) {
    return { items: [], ignoredColumns: ignored, errors: [`Troppi capi: ${rows.length} (massimo ${IMPORT_MAX_ROWS} alla volta).`] };
  }

  const items: ImportedItem[] = [];
  const errors: string[] = [];
  for (const { cells, line } of rows) {
    const raw: Record<ImportField, string> = { brand: "", category: "", size: "", condition: "", expected_price_cents: "", notes: "" };
    map.forEach((field, i) => {
      if (field) raw[field] = (cells[i] ?? "").trim();
    });
    if (raw.condition) {
      const key = raw.condition.toLowerCase().replace(/[\s_-]/g, "");
      raw.condition = CONDITION_ALIASES[key] ?? raw.condition;
    }
    raw.expected_price_cents = raw.expected_price_cents.replace(/€/g, "").trim();

    const parsed = rowSchema.safeParse(raw);
    if (parsed.success) items.push(parsed.data);
    else errors.push(`Riga ${line}: ${parsed.error.issues[0]?.message ?? "valori non validi"}`);
  }
  return { items: errors.length ? [] : items, errors, ignoredColumns: ignored };
}

export const IMPORT_TEMPLATE_HEADER = ["marca", "categoria", "taglia", "condizione", "prezzo previsto", "note"];
