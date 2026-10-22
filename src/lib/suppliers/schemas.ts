import { z } from "zod";
import { parseEuroToCents } from "@/lib/money";
import {
  CLAIM_FIELDS,
  EVIDENCE_LEVELS,
  SUPPLIER_TYPES,
} from "./constants";

/** Stringa dal form: vuota → null. */
const optionalText = z
  .string()
  .trim()
  .max(2000, "Testo troppo lungo")
  .transform((s) => (s === "" ? null : s));

/** Solo http(s): questi valori diventano link, quindi niente "javascript:" e simili. */
const optionalUrl = z
  .string()
  .trim()
  .max(500, "Indirizzo troppo lungo")
  .transform((s, ctx) => {
    if (s === "") return null;
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Indirizzo web non valido" });
      return z.NEVER;
    }
  });

const optionalEuro = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const cents = parseEuroToCents(s);
    if (cents === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Importo non valido (usa la virgola per i decimali, es. 12,50)",
      });
      return z.NEVER;
    }
    return cents;
  });

const optionalInt = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    if (!/^\d{1,9}$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Inserisci un numero intero" });
      return z.NEVER;
    }
    return Number(s);
  });

const optionalDecimal = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 99_999_999) {
      ctx.addIssue({ code: "custom", message: "Inserisci un numero valido" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

/** "IT", "it" → "IT"; vuoto → null. */
const optionalCountry = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    if (!/^[a-zA-Z]{2}$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Usa il codice a 2 lettere (es. IT, DE, PL)" });
      return z.NEVER;
    }
    return s.toUpperCase();
  });

/** "Nike, adidas ,nike" → ["nike","adidas"]: minuscolo, senza doppioni. */
export function parseList(s: string): string[] {
  const items = s
    .split(/[,;\n]/)
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(items)].slice(0, 50);
}

const list = z.string().transform(parseList);

const optionalEmail = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    if (!z.email().safeParse(s).success) {
      ctx.addIssue({ code: "custom", message: "Email non valida" });
      return z.NEVER;
    }
    return s;
  });

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(200, "Nome troppo lungo"),
  website: optionalUrl,
  country: optionalCountry,
  languages: list,
  stock_types: list,
  brands: list,
  supplier_type: z.enum(SUPPLIER_TYPES, "Tipo non valido"),
  min_order_qty: optionalInt,
  min_order_weight_kg: optionalDecimal,
  min_order_value_cents: optionalEuro,
  price_per_kg_cents: optionalEuro,
  price_notes: optionalText,
  contact_name: optionalText,
  contact_email: optionalEmail,
  contact_phone: optionalText,
  notes: optionalText,
});
export type SupplierInput = z.infer<typeof supplierSchema>;

export const sourceSchema = z.object({
  title: z.string().trim().min(1, "Il titolo è obbligatorio").max(200),
  url: optionalUrl,
  retrieved_at: z
    .string()
    .trim()
    .transform((s, ctx) => {
      if (s === "") return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
        ctx.addIssue({ code: "custom", message: "Data non valida" });
        return z.NEVER;
      }
      return s;
    }),
  note: optionalText,
});

export const claimSchema = z
  .object({
    field: z.enum(CLAIM_FIELDS, "Argomento non valido"),
    statement: z.string().trim().min(1, "Scrivi l'informazione").max(1000),
    evidence_level: z.enum(EVIDENCE_LEVELS, "Livello di prova non valido"),
    source_id: z
      .string()
      .trim()
      .transform((s) => (s === "" ? null : s))
      .pipe(z.uuid("Fonte non valida").nullable()),
  })
  .refine((c) => c.evidence_level !== "documentato" || c.source_id !== null, {
    path: ["source_id"],
    message: "Un'informazione documentata richiede una fonte: scegline una (o aggiungila prima).",
  });

const score = z
  .string()
  .trim()
  .regex(/^[0-5]$/, "Il voto va da 0 a 5")
  .transform(Number);

export const evaluationSchema = z.object({
  proximity: score,
  transparency: score,
  min_order: score,
  budget_fit: score,
  vintage_interest: score,
  comment: optionalText,
});

export const uuidSchema = z.uuid();
