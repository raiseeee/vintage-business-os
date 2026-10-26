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
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { PHOTO_BUCKET } from "@/lib/business/constants";
import { getSupabaseEnv } from "@/lib/env";
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

/**
 * Elimina il lotto con i suoi capi e le loro foto. Richiede la password dell'account con cui si è
 * entrati. Si ferma se un capo ha una vendita registrata (prima va annullata).
 */
export async function deleteLot(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await isOwner())) return fail(OWNER_ONLY_MESSAGE);
  if (!validId(id)) return fail("Lotto non valido");

  const password = String(formData.get("password") ?? "");
  if (!password) return fail("Inserisci la password del tuo account per confermare.");

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  const email = userData.user?.email;
  const env = getSupabaseEnv();
  if (!email || !env) return fail("Sessione scaduta: accedi di nuovo.");

  // La password si verifica con un client a parte, che non tocca la sessione in corso.
  const checker = createSupabaseClient(env.url, env.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { error: authError } = await checker.auth.signInWithPassword({ email, password });
  if (authError) return fail("Password non corretta.");

  const { data: items } = await supabase.from("items").select("id").eq("lot_id", id);
  const itemIds = (items ?? []).map((i) => i.id as string);

  if (itemIds.length > 0) {
    const { count } = await supabase.from("sales").select("id", { count: "exact", head: true }).in("item_id", itemIds);
    if ((count ?? 0) > 0) {
      return fail("Alcuni capi di questo lotto sono stati venduti: annulla prima le vendite, poi potrai eliminare il lotto.");
    }
  }

  const { data: photos } = itemIds.length
    ? await supabase.from("item_photos").select("storage_path").in("item_id", itemIds)
    : { data: [] as { storage_path: string }[] };

  if (itemIds.length > 0) {
    const { error: itemsError } = await supabase.from("items").delete().eq("lot_id", id);
    if (itemsError) return fail(dbErrorMessage(itemsError));
  }

  const { error } = await supabase.from("purchase_lots").delete().eq("id", id);
  if (error) return fail(dbErrorMessage(error));

  const paths = (photos ?? []).map((p) => p.storage_path as string);
  if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);

  revalidatePath("/capi");
  revalidateLots();
  redirect("/lotti");
}
