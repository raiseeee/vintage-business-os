"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ZodType } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  claimSchema,
  evaluationSchema,
  sourceSchema,
  supplierSchema,
  uuidSchema,
} from "@/lib/suppliers/schemas";

export type FormState = {
  error: string | null;
  ok: boolean;
  /** Valori inviati, restituiti in caso di errore per non far perdere ciò che è stato scritto. */
  values?: Record<string, string>;
};

const fail = (error: string, formData?: FormData): FormState => ({
  error,
  ok: false,
  values: formData ? formValues(formData) : undefined,
});
const success: FormState = { error: null, ok: true };

/** Legge i valori testuali del form (i file e gli altri tipi vengono ignorati). */
function formValues(formData: FormData): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") out[key] = value;
  }
  return out;
}

function parse<T>(schema: ZodType<T>, formData: FormData):
  | { ok: true; data: T }
  | { ok: false; error: string } {
  const result = schema.safeParse(formValues(formData));
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  return { ok: false, error: issue?.message ?? "Dati non validi" };
}

/**
 * Traduce gli errori del database in messaggi comprensibili.
 * I messaggi dei nostri trigger (in italiano) sono sicuri da mostrare;
 * degli altri errori non si espongono i dettagli interni.
 */
function dbErrorMessage(error: { code?: string; message?: string }): string {
  if (
    error.code === "23514" &&
    (error.message?.startsWith("Il tipo") || error.message?.startsWith("Impossibile rimuovere"))
  ) {
    return error.message;
  }
  switch (error.code) {
    case "23514":
      return "Uno dei valori non rispetta i limiti consentiti.";
    case "23503":
      return "Il dato è collegato ad altri elementi e non può essere modificato o rimosso così.";
    case "23505":
      return "Esiste già un elemento uguale.";
    default:
      return "Operazione non riuscita. Riprova.";
  }
}

function validId(id: string): boolean {
  return uuidSchema.safeParse(id).success;
}

export async function createSupplier(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = parse(supplierSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) return fail(error ? dbErrorMessage(error) : "Operazione non riuscita. Riprova.", formData);

  revalidatePath("/fornitori");
  redirect(`/fornitori/${data.id}`);
}

export async function updateSupplier(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(id)) return fail("Fornitore non valido");
  const parsed = parse(supplierSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(parsed.data).eq("id", id);
  if (error) return fail(dbErrorMessage(error), formData);

  revalidatePath("/fornitori");
  revalidatePath(`/fornitori/${id}`);
  return success;
}

export async function addSource(
  supplierId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(supplierId)) return fail("Fornitore non valido");
  const parsed = parse(sourceSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_sources")
    .insert({ ...parsed.data, supplier_id: supplierId });
  if (error) return fail(dbErrorMessage(error), formData);

  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}

export async function deleteSource(
  supplierId: string,
  sourceId: string,
): Promise<FormState> {
  if (!validId(supplierId) || !validId(sourceId)) return fail("Elemento non valido");
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_sources").delete().eq("id", sourceId);
  if (error) {
    // Il database rifiuta (restrict) se alcune informazioni dipendono ancora dalla fonte.
    return fail(
      error.code === "23503"
        ? "Questa fonte sostiene delle informazioni: eliminale prima."
        : dbErrorMessage(error),
    );
  }
  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}

export async function addClaim(
  supplierId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(supplierId)) return fail("Fornitore non valido");
  const parsed = parse(claimSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_claims")
    .insert({ ...parsed.data, supplier_id: supplierId });
  if (error) return fail(dbErrorMessage(error), formData);

  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}

export async function deleteClaim(
  supplierId: string,
  claimId: string,
): Promise<FormState> {
  if (!validId(supplierId) || !validId(claimId)) return fail("Elemento non valido");
  const supabase = await createClient();
  const { error } = await supabase.from("supplier_claims").delete().eq("id", claimId);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}

export async function addEvaluation(
  supplierId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(supplierId)) return fail("Fornitore non valido");
  const parsed = parse(evaluationSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase
    .from("supplier_evaluations")
    .insert({ ...parsed.data, supplier_id: supplierId });
  if (error) return fail(dbErrorMessage(error), formData);

  revalidatePath("/fornitori");
  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}

export async function loadDemoData(): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("load_demo_data");
  if (error) {
    return fail(
      error.message?.includes("già presenti")
        ? "I dati demo sono già presenti."
        : "Impossibile caricare i dati demo.",
    );
  }
  revalidatePath("/fornitori");
  return success;
}

export async function clearDemoData(): Promise<FormState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("clear_demo_data");
  if (error) return fail("Impossibile rimuovere i dati demo.");
  revalidatePath("/fornitori");
  return success;
}
