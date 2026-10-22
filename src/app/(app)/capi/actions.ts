"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PHOTO_BUCKET } from "@/lib/business/constants";
import { fetchAll } from "@/lib/business/paginate";
import {
  bulkItemsSchema,
  itemCreateSchema,
  itemFieldsSchema,
  photoPathSchema,
  saleSchema,
} from "@/lib/business/schemas";
import {
  dbErrorMessage,
  fail,
  parseForm,
  success,
  validId,
  type FormState,
} from "@/lib/form-action";
import { createClient } from "@/lib/supabase/server";

function revalidateItems(itemId?: string, lotId?: string) {
  revalidatePath("/capi");
  revalidatePath("/lotti");
  revalidatePath("/dashboard");
  revalidatePath("/fornitori");
  if (itemId) revalidatePath(`/capi/${itemId}`);
  if (lotId) revalidatePath(`/lotti/${lotId}`);
}

const DUPLICATE_CODE = "Esiste già un capo con questo codice.";

export async function createItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(itemCreateSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { data, error } = await supabase.from("items").insert(parsed.data).select("id").single();
  if (error || !data) {
    return fail(
      error?.code === "23505" ? DUPLICATE_CODE : error ? dbErrorMessage(error) : "Operazione non riuscita. Riprova.",
      formData,
    );
  }

  revalidateItems(undefined, parsed.data.lot_id);
  redirect(`/capi/${data.id}`);
}

/** Crea N capi vuoti con codici progressivi (<codice lotto>-001, -002…), da completare poi. */
export async function createItemsBulk(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(bulkItemsSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);
  const { lot_id, count } = parsed.data;

  const supabase = await createClient();
  const { data: lot, error: lotError } = await supabase
    .from("purchase_lots")
    .select("code")
    .eq("id", lot_id)
    .maybeSingle();
  if (lotError || !lot) return fail("Lotto non trovato", formData);

  const existing = await fetchAll<{ code: string }>((from, to) =>
    supabase.from("items").select("code").eq("lot_id", lot_id).order("id").range(from, to),
  );

  // Riparte dal numero successivo al più alto già usato nel lotto.
  const pattern = new RegExp(`^${lot.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);
  const used = existing.map((e) => Number(pattern.exec(e.code)?.[1] ?? 0));
  const start = Math.max(0, ...used) + 1;

  const rows = Array.from({ length: count }, (_, i) => ({
    lot_id,
    code: `${lot.code}-${String(start + i).padStart(3, "0")}`,
    status: "da_controllare" as const,
  }));

  const { error } = await supabase.from("items").insert(rows);
  if (error) {
    return fail(error.code === "23505" ? DUPLICATE_CODE : dbErrorMessage(error), formData);
  }

  revalidateItems(undefined, lot_id);
  return { error: null, ok: true };
}

export async function updateItem(
  id: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(id)) return fail("Capo non valido");
  const parsed = parseForm(itemFieldsSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { data: current, error: readError } = await supabase
    .from("items")
    .select("status, lot_id")
    .eq("id", id)
    .maybeSingle();
  if (readError || !current) return fail("Capo non trovato", formData);

  // Un capo venduto resta tale finché non si annulla la vendita o si segna come reso.
  const update: Record<string, unknown> = { ...parsed.data };
  if (current.status === "venduto") delete update.status;

  const { error } = await supabase.from("items").update(update).eq("id", id);
  if (error) {
    return fail(error.code === "23505" ? DUPLICATE_CODE : dbErrorMessage(error), formData);
  }

  revalidateItems(id, current.lot_id);
  return success;
}

export async function deleteItem(id: string): Promise<FormState> {
  if (!validId(id)) return fail("Capo non valido");

  const supabase = await createClient();

  // Prima di eliminare il capo (le righe delle foto spariscono a cascata) si annotano i file.
  const { data: photos } = await supabase.from("item_photos").select("storage_path").eq("item_id", id);
  const { data: item } = await supabase.from("items").select("lot_id").eq("id", id).maybeSingle();

  const { error } = await supabase.from("items").delete().eq("id", id);
  if (error) {
    return fail(
      error.code === "23503"
        ? "Il capo ha una vendita registrata: annullala prima di eliminarlo."
        : dbErrorMessage(error),
    );
  }

  const paths = (photos ?? []).map((p) => p.storage_path as string);
  if (paths.length > 0) await supabase.storage.from(PHOTO_BUCKET).remove(paths);

  revalidateItems(undefined, item?.lot_id);
  redirect("/capi");
}

export async function recordSale(
  itemId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  if (!validId(itemId)) return fail("Capo non valido");
  const parsed = parseForm(saleSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);
  const s = parsed.data;

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_sale", {
    p_item_id: itemId,
    p_channel: s.channel,
    p_sold_at: s.sold_at,
    p_price_cents: s.price_cents,
    p_fees_cents: s.fees_cents,
    p_outbound_shipping_cents: s.outbound_shipping_cents,
    p_extra_costs_cents: s.extra_costs_cents,
    p_notes: s.notes,
  });
  if (error) return fail(dbErrorMessage(error), formData);

  revalidateItems(itemId);
  return success;
}

export async function undoSale(itemId: string): Promise<FormState> {
  if (!validId(itemId)) return fail("Capo non valido");

  const supabase = await createClient();
  const { error } = await supabase.rpc("undo_sale", { p_item_id: itemId });
  if (error) return fail(dbErrorMessage(error));

  revalidateItems(itemId);
  return success;
}

/** Il cliente ha restituito il capo: esce da ricavi e valore dello stock finché non lo rivaluti. */
export async function markReturned(itemId: string): Promise<FormState> {
  if (!validId(itemId)) return fail("Capo non valido");

  const supabase = await createClient();
  const { error } = await supabase
    .from("items")
    .update({ status: "reso" })
    .eq("id", itemId)
    .eq("status", "venduto");
  if (error) return fail(dbErrorMessage(error));

  revalidateItems(itemId);
  return success;
}

/** Registra nel database una foto già caricata nello storage dal browser. */
export async function registerPhoto(itemId: string, path: string): Promise<FormState> {
  if (!validId(itemId)) return fail("Capo non valido");

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Sessione scaduta: accedi di nuovo.");

  // Il file deve stare nella cartella dell'utente e di questo capo.
  if (!photoPathSchema(auth.user.id, itemId).safeParse(path).success) {
    return fail("Percorso foto non valido");
  }

  const { count } = await supabase
    .from("item_photos")
    .select("id", { count: "exact", head: true })
    .eq("item_id", itemId);

  const { error } = await supabase
    .from("item_photos")
    .insert({ item_id: itemId, storage_path: path, position: count ?? 0 });
  if (error) return fail(dbErrorMessage(error));

  revalidatePath(`/capi/${itemId}`);
  revalidatePath("/capi");
  return success;
}

export async function deletePhoto(itemId: string, photoId: string): Promise<FormState> {
  if (!validId(itemId) || !validId(photoId)) return fail("Elemento non valido");

  const supabase = await createClient();
  const { data: photo } = await supabase
    .from("item_photos")
    .select("storage_path")
    .eq("id", photoId)
    .eq("item_id", itemId)
    .maybeSingle();
  if (!photo) return fail("Foto non trovata");

  const { error } = await supabase.from("item_photos").delete().eq("id", photoId);
  if (error) return fail(dbErrorMessage(error));

  await supabase.storage.from(PHOTO_BUCKET).remove([photo.storage_path as string]);

  revalidatePath(`/capi/${itemId}`);
  revalidatePath("/capi");
  return success;
}
