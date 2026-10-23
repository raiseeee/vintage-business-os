"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  dbErrorMessage,
  fail,
  parseForm as parse,
  success,
  validId,
  type FormState,
} from "@/lib/form-action";
import {
  claimSchema,
  contactSchema,
  crmSchema,
  evaluationSchema,
  sourceSchema,
  supplierSchema,
} from "@/lib/suppliers/schemas";

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

export async function updateCrm(
  supplierId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(supplierId)) return fail("Fornitore non valido");
  const parsed = parse(crmSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(parsed.data).eq("id", supplierId);
  if (error) return fail(dbErrorMessage(error), formData);

  revalidatePath("/crm");
  revalidatePath("/fornitori");
  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}

export async function addContact(
  supplierId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(supplierId)) return fail("Fornitore non valido");
  const parsed = parse(contactSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase
    .from("contact_log")
    .insert({ ...parsed.data, supplier_id: supplierId });
  if (error) return fail(dbErrorMessage(error), formData);

  revalidatePath("/crm");
  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}

export async function deleteContact(
  supplierId: string,
  contactId: string,
): Promise<FormState> {
  if (!validId(supplierId) || !validId(contactId)) return fail("Dati non validi");
  const supabase = await createClient();
  const { error } = await supabase.from("contact_log").delete().eq("id", contactId);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/crm");
  revalidatePath(`/fornitori/${supplierId}`);
  return success;
}
