import { z } from "zod";
import {
  codeField,
  euroOrZero,
  optionalDecimal,
  optionalEuro,
  optionalText,
  positiveInt,
  requiredDate,
  requiredEuro,
  shortText,
} from "@/lib/validation";
import { ITEM_CONDITIONS, MANUAL_ITEM_STATUSES } from "./constants";

const uuid = z.uuid("Elemento non valido");

export const lotSchema = z.object({
  supplier_id: uuid,
  code: codeField,
  purchased_at: requiredDate,
  purchase_cost_cents: requiredEuro,
  inbound_shipping_cents: euroOrZero,
  other_costs_cents: euroOrZero,
  quantity: positiveInt,
  weight_kg: optionalDecimal,
  notes: optionalText,
});

const conditionField = z
  .string()
  .trim()
  .transform((s) => (s === "" ? null : s))
  .pipe(z.enum(ITEM_CONDITIONS, "Condizione non valida").nullable());

/** Campi modificabili di un capo (il lotto di provenienza non cambia). */
export const itemFieldsSchema = z.object({
  code: codeField,
  brand: shortText,
  category: shortText,
  size: shortText,
  condition: conditionField,
  status: z.enum(MANUAL_ITEM_STATUSES as [string, ...string[]], "Stato non valido"),
  expected_price_cents: optionalEuro,
  notes: optionalText,
});

export const itemCreateSchema = itemFieldsSchema.extend({ lot_id: uuid });

export const bulkItemsSchema = z.object({
  lot_id: uuid,
  count: positiveInt.refine((n) => n <= 200, "Massimo 200 capi alla volta"),
});

export const saleSchema = z.object({
  channel: z.string().trim().min(1, "Indica il canale di vendita").max(60, "Canale troppo lungo"),
  sold_at: requiredDate,
  price_cents: requiredEuro,
  fees_cents: euroOrZero,
  outbound_shipping_cents: euroOrZero,
  extra_costs_cents: euroOrZero,
  notes: optionalText,
});

/** Percorso di una foto: <user_id>/<item_id>/<file>.<jpg|png|webp> */
export function photoPathSchema(userId: string, itemId: string) {
  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return z
    .string()
    .regex(
      new RegExp(`^${escape(userId)}/${escape(itemId)}/[A-Za-z0-9-]{8,64}\\.(jpg|png|webp)$`),
      "Percorso foto non valido",
    );
}
