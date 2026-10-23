import { z } from "zod";
import {
  optionalDecimal,
  optionalEuro,
  optionalInt,
  optionalText,
  optionalUrl,
} from "@/lib/validation";
import {
  CLAIM_FIELDS,
  CONTACT_CHANNELS,
  CONTACT_STATUSES,
  EVIDENCE_LEVELS,
  SUPPLIER_TYPES,
} from "./constants";

/** Data AAAA-MM-GG; vuoto → null. */
const optionalDate = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || Number.isNaN(Date.parse(s))) {
      ctx.addIssue({ code: "custom", message: "Data non valida" });
      return z.NEVER;
    }
    return s;
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

/** CRM: stato del contatto e prossima azione. La data non ha senso senza l'azione. */
export const crmSchema = z
  .object({
    contact_status: z.enum(CONTACT_STATUSES, "Stato non valido"),
    next_action: optionalText,
    next_action_date: optionalDate,
  })
  .superRefine((v, ctx) => {
    if (v.next_action_date && !v.next_action) {
      ctx.addIssue({ code: "custom", path: ["next_action"], message: "Descrivi la prossima azione o togli la data" });
    }
  });

/** Un contatto avvenuto: la data è obbligatoria (mezzogiorno UTC, per non slittare di giorno). */
export const contactSchema = z.object({
  channel: z.enum(CONTACT_CHANNELS, "Canale non valido"),
  contacted_at: optionalDate
    .refine((d) => d !== null, "La data è obbligatoria")
    .transform((d) => `${d}T12:00:00Z`),
  summary: z.string().trim().min(1, "Scrivi un riassunto del contatto").max(2000),
});
