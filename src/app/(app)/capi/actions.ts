"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { PHOTO_BUCKET } from "@/lib/business/constants";
import { NO_PHOTO_MESSAGE, statusAfterPhoto, statusForRequest, type ItemStatusKey } from "@/lib/business/status";
import { fetchAll } from "@/lib/business/paginate";
import { IMPORT_MAX_BYTES, parseItemImport } from "@/lib/business/import";
import {
  publishSchema,
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
import { getMembership, isOwner, OWNER_ONLY_MESSAGE } from "@/lib/team/membership";

function revalidateItems(itemId?: string, lotId?: string) {
  revalidatePath("/capi");
  revalidatePath("/lotti");
  revalidatePath("/dashboard");
  revalidatePath("/inventario");
  if (itemId) revalidatePath(`/capi/${itemId}`);
  if (lotId) revalidatePath(`/lotti/${lotId}`);
}

const DUPLICATE_CODE = "Esiste già un capo con questo codice.";

export async function createItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(itemCreateSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  // Senza foto un capo non può essere «pronto» né «pubblicato». Se le foto vengono caricate subito dopo
  // (has_photos) lo stato scelto si rispetta: la prima foto, se serve, lo porta comunque a «pronto».
  const withPhotos = formData.get("has_photos") === "1";
  const { status, adjusted } = statusForRequest(parsed.data.status as ItemStatusKey, withPhotos ? 1 : 0);

  const supabase = await createClient();
  const { data, error } = await supabase.from("items").insert({ ...parsed.data, status }).select("id").single();
  if (error || !data) {
    return fail(
      error?.code === "23505" ? DUPLICATE_CODE : error ? dbErrorMessage(error) : "Operazione non riuscita. Riprova.",
      formData,
    );
  }

  revalidateItems(undefined, parsed.data.lot_id);
  return { error: null, ok: true, itemId: data.id, ...(adjusted ? { message: NO_PHOTO_MESSAGE } : {}) };
}

type Supabase = Awaited<ReturnType<typeof createClient>>;

/** Prossimi codici liberi del lotto: <codice lotto>-001, -002… dal numero successivo al più alto usato. */
async function nextItemCodes(
  supabase: Supabase,
  lotId: string,
  count: number,
): Promise<string[] | null> {
  const { data: lot, error: lotError } = await supabase
    .from("purchase_lots")
    .select("code")
    .eq("id", lotId)
    .maybeSingle();
  if (lotError || !lot) return null;

  const existing = await fetchAll<{ code: string }>((from, to) =>
    supabase.from("items").select("code").eq("lot_id", lotId).order("id").range(from, to),
  );

  const pattern = new RegExp(`^${lot.code.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);
  const used = existing.map((e) => Number(pattern.exec(e.code)?.[1] ?? 0));
  const start = Math.max(0, ...used) + 1;
  return Array.from({ length: count }, (_, i) => `${lot.code}-${String(start + i).padStart(3, "0")}`);
}

/** Crea N capi vuoti con codici progressivi (<codice lotto>-001, -002…), da completare poi. */
export async function createItemsBulk(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(bulkItemsSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);
  const { lot_id, count } = parsed.data;

  const supabase = await createClient();
  const codes = await nextItemCodes(supabase, lot_id, count);
  if (!codes) return fail("Lotto non trovato", formData);

  const rows = codes.map((code) => ({ lot_id, code, status: "da_controllare" as const }));
  const { error } = await supabase.from("items").insert(rows);
  if (error) {
    return fail(error.code === "23505" ? DUPLICATE_CODE : dbErrorMessage(error), formData);
  }

  revalidateItems(undefined, lot_id);
  return { error: null, ok: true };
}

/**
 * Importa i capi da un CSV nel lotto scelto: codici progressivi del lotto e stato «da controllare».
 * Tutto o niente: se una riga non è valida non viene importato nulla.
 */
export async function importItems(_prev: FormState, formData: FormData): Promise<FormState> {
  const lotId = String(formData.get("lot_id") ?? "");
  if (!validId(lotId)) return fail("Scegli il lotto di provenienza.");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return fail("Scegli un file CSV da importare.");
  if (file.size > IMPORT_MAX_BYTES) return fail("File troppo grande (massimo circa 900 KB).");

  const result = parseItemImport(await file.text());
  if (result.errors.length > 0) {
    const shown = result.errors.slice(0, 10);
    const more = result.errors.length - shown.length;
    return fail(`Nessun capo importato:\n${shown.join("\n")}${more > 0 ? `\n… e altri ${more} errori` : ""}`);
  }

  const supabase = await createClient();
  const codes = await nextItemCodes(supabase, lotId, result.items.length);
  if (!codes) return fail("Lotto non trovato.");

  const rows = result.items.map((item, i) => ({ ...item, lot_id: lotId, code: codes[i], status: "da_controllare" as const }));
  const { error } = await supabase.from("items").insert(rows);
  if (error) return fail(error.code === "23505" ? DUPLICATE_CODE : dbErrorMessage(error));

  revalidateItems(undefined, lotId);
  const ignored = result.ignoredColumns.length > 0 ? ` Colonne ignorate: ${result.ignoredColumns.join(", ")}.` : "";
  return {
    error: null,
    ok: true,
    message: `Importati ${rows.length} capi: da ${codes[0]} a ${codes[codes.length - 1]}, stato «da controllare».${ignored}`,
  };
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
  let adjusted = false;
  if (current.status === "venduto") {
    delete update.status;
  } else {
    // Senza foto un capo non può essere «pronto» né «pubblicato»: resta «da fotografare».
    const { count } = await supabase.from("item_photos").select("id", { count: "exact", head: true }).eq("item_id", id);
    const result = statusForRequest(parsed.data.status as ItemStatusKey, count ?? 0);
    update.status = result.status;
    adjusted = result.adjusted;
  }

  const { error } = await supabase.from("items").update(update).eq("id", id);
  if (error) {
    return fail(error.code === "23505" ? DUPLICATE_CODE : dbErrorMessage(error), formData);
  }

  revalidateItems(id, current.lot_id);
  return adjusted ? { error: null, ok: true, message: NO_PHOTO_MESSAGE } : success;
}

export async function deleteItem(id: string): Promise<FormState> {
  if (!(await isOwner())) return fail(OWNER_ONLY_MESSAGE);
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
  if (!(await isOwner())) return fail(OWNER_ONLY_MESSAGE);
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
  const membership = await getMembership();
  if (!membership) return fail("Sessione scaduta: accedi di nuovo.");

  // Il file deve stare nella cartella dell'attività e di questo capo.
  if (!photoPathSchema(membership.businessId, itemId).safeParse(path).success) {
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

  // La prima foto porta il capo «da controllare» o «da fotografare» a «pronto per la vendita».
  const { data: current } = await supabase.from("items").select("status").eq("id", itemId).maybeSingle();
  const next = current ? statusAfterPhoto(current.status as ItemStatusKey) : null;
  if (next) await supabase.from("items").update({ status: next }).eq("id", itemId).eq("status", current!.status);

  revalidatePath(`/capi/${itemId}`);
  revalidatePath("/capi");
  revalidatePath("/lotti");
  revalidatePath("/dashboard");
  return success;
}

/**
 * Mette «in vendita» un capo pronto: chiede dove e lo porta a «pubblicato».
 * Il canale resta sul capo e viene proposto quando poi registri la vendita.
 */
export async function publishItem(itemId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!validId(itemId)) return fail("Capo non valido");
  const parsed = parseForm(publishSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { data: current } = await supabase.from("items").select("status, lot_id").eq("id", itemId).maybeSingle();
  if (!current) return fail("Capo non trovato", formData);
  if (current.status !== "pronto" && current.status !== "pubblicato") {
    return fail("Solo un capo «pronto per la vendita» si può pubblicare.", formData);
  }

  const today = new Date().toISOString().slice(0, 10);
  let { error } = await supabase
    .from("items")
    .update({ status: "pubblicato", listing_channel: parsed.data.channel, listed_at: today })
    .eq("id", itemId);
  // Database senza la migrazione della pubblicazione: il capo diventa comunque «pubblicato».
  if (error && (error.code === "42703" || error.code === "PGRST204")) {
    ({ error } = await supabase.from("items").update({ status: "pubblicato" }).eq("id", itemId));
  }
  if (error) return fail(dbErrorMessage(error), formData);

  revalidateItems(itemId, current.lot_id);
  return success;
}

export async function deletePhoto(itemId: string, photoId: string): Promise<FormState> {
  if (!(await isOwner())) return fail(OWNER_ONLY_MESSAGE);
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
