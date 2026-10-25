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
import { isOwner, OWNER_ONLY_MESSAGE } from "@/lib/team/membership";

function revalidateLots(lotId?: string) {
  revalidatePath("/lotti");
  revalidatePath("/dashboard");
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

  // Crea subito i capi del lotto (<codice>-001, -002…), da completare poi.
  const total = Math.min(parsed.data.quantity, 1000);
  const pad = Math.max(3, String(total).length);
  const rows = Array.from({ length: total }, (_, i) => ({
    lot_id: data.id,
    code: `${parsed.data.code}-${String(i + 1).padStart(pad, "0")}`,
    status: "da_controllare" as const,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error: itemsError } = await supabase.from("items").insert(rows.slice(i, i + 200));
    if (itemsError) break; // il lotto c'è: i capi mancanti si aggiungono dalla sua pagina
  }

  revalidateLots();
  revalidatePath("/capi");
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
  if (!(await isOwner())) return fail(OWNER_ONLY_MESSAGE);
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
