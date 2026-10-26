"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { dbErrorMessage, fail, parseForm, success, validId, type FormState } from "@/lib/form-action";
import { supplierSchema } from "@/lib/suppliers/schemas";
import { createClient } from "@/lib/supabase/server";
import { isOwner, OWNER_ONLY_MESSAGE } from "@/lib/team/membership";

function refresh(id?: string) {
  revalidatePath("/fornitori");
  revalidatePath("/lotti");
  revalidatePath("/capi");
  revalidatePath("/statistiche");
  if (id) revalidatePath(`/fornitori/${id}`);
}

function supplierError(error: { code?: string; message?: string }): string {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return "Applica prima la migrazione dei fornitori al database (vedi README).";
  }
  return dbErrorMessage(error);
}

export async function createSupplier(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(supplierSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").insert(parsed.data);
  if (error) return fail(supplierError(error), formData);
  refresh();
  return success;
}

export async function updateSupplier(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!validId(id)) return fail("Fornitore non valido");
  const parsed = parseForm(supplierSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").update(parsed.data).eq("id", id);
  if (error) return fail(supplierError(error), formData);
  refresh(id);
  return success;
}

/** I lotti del fornitore restano, senza fornitore. */
export async function deleteSupplier(id: string): Promise<FormState> {
  if (!(await isOwner())) return fail(OWNER_ONLY_MESSAGE);
  if (!validId(id)) return fail("Fornitore non valido");
  const supabase = await createClient();
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) return fail(supplierError(error));
  refresh();
  redirect("/fornitori");
}
