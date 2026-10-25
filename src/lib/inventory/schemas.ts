import { z } from "zod";
import { optionalText, positiveInt, requiredDate, requiredEuro } from "@/lib/validation";
import { INVENTORY_KINDS } from "./calc";

/** Numero con la virgola, 0–1000 (es. «0,5» scatole per capo). */
const perItemQty = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return 1;
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 1000) {
      ctx.addIssue({ code: "custom", message: "Quantità per capo non valida (es. 1 oppure 0,5)" });
      return z.NEVER;
    }
    return Math.round(n * 1000) / 1000;
  });

export const inventorySchema = z
  .object({
    kind: z.enum(INVENTORY_KINDS, "Scegli il tipo di voce"),
    name: z.string().trim().min(1, "Il nome è obbligatorio").max(120, "Nome troppo lungo"),
    total_cost_cents: requiredEuro,
    quantity: positiveInt,
    per_item_qty: perItemQty,
    in_use: z.enum(["si", "no"]).default("no"),
    purchased_at: requiredDate,
    notes: optionalText,
  })
  .transform((v) => {
    const isMaterial = v.kind === "materiale";
    return {
      kind: v.kind,
      name: v.name,
      total_cost_cents: v.total_cost_cents,
      quantity: v.quantity,
      // Un'attrezzatura non ha una quantità per capo e non entra nel costo dei capi.
      per_item_qty: isMaterial ? v.per_item_qty : 0,
      in_use: isMaterial && v.in_use === "si",
      purchased_at: v.purchased_at,
      notes: v.notes,
    };
  });
