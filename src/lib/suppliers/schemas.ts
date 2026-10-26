import { z } from "zod";
import { optionalText } from "@/lib/validation";

export const supplierSchema = z.object({
  name: z.string().trim().min(1, "Il nome è obbligatorio").max(120, "Nome troppo lungo (massimo 120 caratteri)"),
  email: optionalText,
  phone: optionalText,
  address: optionalText,
  notes: optionalText,
});
