import { z } from "zod";

/** Dati per creare un account collaboratore dall'app. */
export const newAccountSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Inserisci un indirizzo email valido")),
  password: z
    .string()
    .min(10, "La password deve avere almeno 10 caratteri")
    .max(72, "La password può avere al massimo 72 caratteri"),
  role: z.enum(["collaborator", "owner"]),
});
