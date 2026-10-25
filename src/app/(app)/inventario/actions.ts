"use server";

import { revalidatePath } from "next/cache";
import { dbErrorMessage, fail, parseForm, success, validId, type FormState } from "@/lib/form-action";
import { inventorySchema } from "@/lib/inventory/schemas";
import { createClient } from "@/lib/supabase/server";
import { isOwner, OWNER_ONLY_MESSAGE } from "@/lib/team/membership";

function refresh() {
  revalidatePath("/inventario");
  revalidatePath("/statistiche");
  revalidatePath("/calcolatore");
}

function inventoryError(error: { code?: string; message?: string }): string {
  if (error.code === "42P01" || error.code === "PGRST205") {
    return "Applica prima la migrazione dell'inventario al database (vedi README).";
  }
  return dbErrorMessage(error);
}

export async function createInventoryItem(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parseForm(inventorySchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").insert(parsed.data);
  if (error) return fail(inventoryError(error), formData);
  refresh();
  return success;
}

export async function updateInventoryItem(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  if (!validId(id)) return fail("Voce non valida");
  const parsed = parseForm(inventorySchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update(parsed.data).eq("id", id);
  if (error) return fail(inventoryError(error), formData);
  refresh();
  return success;
}

/** Accende o spegne un materiale (es. quando finisci una confezione e ne compri un'altra a un altro prezzo). */
export async function setInUse(id: string, inUse: boolean): Promise<FormState> {
  if (!validId(id)) return fail("Voce non valida");
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").update({ in_use: inUse }).eq("id", id).eq("kind", "materiale");
  if (error) return fail(inventoryError(error));
  refresh();
  return success;
}

export async function deleteInventoryItem(id: string): Promise<FormState> {
  if (!(await isOwner())) return fail(OWNER_ONLY_MESSAGE);
  if (!validId(id)) return fail("Voce non valida");
  const supabase = await createClient();
  const { error } = await supabase.from("inventory_items").delete().eq("id", id);
  if (error) return fail(inventoryError(error));
  refresh();
  return success;
}
