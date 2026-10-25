import type { ZodType } from "zod";
import { uuidSchema } from "@/lib/validation";

/** Esito di una server action collegata a un form. */
export type FormState = {
  error: string | null;
  ok: boolean;
  /** Valori inviati, restituiti in caso di errore per non far perdere ciò che è stato scritto. */
  values?: Record<string, string>;
  /** Messaggio di successo calcolato dall'azione (al posto di quello fisso del form). */
  message?: string;
  /** Id del record creato, quando serve al chiamante. */
  itemId?: string;
};

/** Legge i valori testuali del form (i file e gli altri tipi vengono ignorati). */
export function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

export const success: FormState = { error: null, ok: true };

export function fail(error: string, formData?: FormData): FormState {
  return { error, ok: false, values: formData ? formValues(formData) : undefined };
}

export function parseForm<T>(
  schema: ZodType<T>,
  formData: FormData,
): { ok: true; data: T } | { ok: false; error: string } {
  const result = schema.safeParse(formValues(formData));
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Dati non validi" };
}

export function validId(id: string): boolean {
  return uuidSchema.safeParse(id).success;
}

/**
 * Traduce gli errori del database in messaggi comprensibili.
 * I messaggi dei nostri trigger e funzioni (in italiano) sono sicuri da mostrare;
 * degli altri errori non si espongono i dettagli interni.
 */
export function dbErrorMessage(error: { code?: string; message?: string }): string {
  switch (error.code) {
    case "23514":
      return "Uno dei valori non rispetta i limiti consentiti.";
    case "23503":
      return "Il dato è collegato ad altri elementi e non può essere modificato o rimosso così.";
    case "23505":
      return "Esiste già un elemento con lo stesso codice o la stessa chiave.";
    case "42501":
      return "Non hai il permesso per questa operazione.";
    case "P0002":
      return "Elemento non trovato.";
    default:
      return "Operazione non riuscita. Riprova.";
  }
}
