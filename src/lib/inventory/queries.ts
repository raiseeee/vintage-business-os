import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { InventoryRow } from "./calc";

/**
 * Voci dell'inventario. `available: false` finché la migrazione dell'inventario non è stata applicata:
 * l'app continua a funzionare (costo materiali = 0) e la pagina spiega cosa fare.
 */
export async function getInventory(): Promise<{ rows: InventoryRow[]; available: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, kind, name, total_cost_cents, quantity, per_item_qty, in_use, purchased_at, notes")
    .order("purchased_at", { ascending: false })
    .order("name")
    .limit(1000);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return { rows: [], available: false };
    throw new Error("Impossibile leggere l'inventario");
  }
  return { rows: (data ?? []).map((r) => ({ ...r, per_item_qty: Number(r.per_item_qty) })) as InventoryRow[], available: true };
}

