"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { lotSchema } from "@/lib/business/schemas";
import {
  dbErrorMessage,
  fail,
  parseForm,
  validId,
  success,
  type FormState,
} from "@/lib/form-action";
import { createClient } from "@/lib/supabase/server";

function revalidateLots(lotId?: string) {
  revalidatePath("/lotti");
  revalidatePath("/dashboard");
  revalidatePath("/fornitori");
  if (lotId) revalidatePath(`/lotti/${lotId}`);
}

export async function createLot(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(lotSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("purchase_lots")
    .insert(parsed.data)
    .select("id")
    .single();
  if (error || !data) {
    return fail(
      error?.code === "23505" ? "Esiste già un lotto con questo codice." : error ? dbErrorMessage(error) : "Operazione non riuscita. Riprova.",
      formData,
    );
  }

  revalidateLots();
  redirect(`/lotti/${data.id}`);
}

export async function updateLot(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(id)) return fail("Lotto non valido");
  const parsed = parseForm(lotSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_lots").update(parsed.data).eq("id", id);
  if (error) {
    return fail(
      error.code === "23505" ? "Esiste già un lotto con questo codice." : dbErrorMessage(error),
      formData,
    );
  }

  revalidateLots(id);
  return success;
}

export async function deleteLot(id: string): Promise<FormState> {
  if (!validId(id)) return fail("Lotto non valido");

  const supabase = await createClient();
  const { error } = await supabase.from("purchase_lots").delete().eq("id", id);
  if (error) {
    return fail(
      error.code === "23503"
        ? "Il lotto contiene dei capi: eliminali prima."
        : dbErrorMessage(error),
    );
  }

  revalidateLots();
  redirect("/lotti");
}
