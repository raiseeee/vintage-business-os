import "server-only";
import { fetchAll } from "@/lib/business/paginate";
import { createClient } from "@/lib/supabase/server";
import type { InventoryRow } from "./calc";

/**
 * Voci dell'inventario. `available: false` finché la migrazione dell'inventario non è stata applicata:
 * l'app continua a funzionare (costo materiali = 0) e la pagina spiega cosa fare.
 */
export interface InventoryData {
  rows: InventoryRow[];
  available: boolean;
  /** Pezzi consumati dalle vendite, per voce. Vuoto se la migrazione della giacenza non è ancora applicata. */
  used: Record<string, number>;
  stockTracked: boolean;
}

export async function getInventory(): Promise<InventoryData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, kind, name, total_cost_cents, quantity, per_item_qty, in_use, purchased_at, notes")
    .order("purchased_at", { ascending: false })
    .order("name")
    .limit(1000);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return { rows: [], available: false, used: {}, stockTracked: false };
    throw new Error("Impossibile leggere l'inventario");
  }
  const rows = (data ?? []).map((r) => ({ ...r, per_item_qty: Number(r.per_item_qty) })) as InventoryRow[];

  // Consumi per voce (tabella della giacenza: può mancare finché non si applica la sua migrazione).
  const used: Record<string, number> = {};
  let stockTracked = true;
  try {
    const consumption = await fetchAll<{ inventory_item_id: string; qty: number | string }>((from, to) =>
      supabase.from("sale_materials").select("inventory_item_id, qty").order("sale_id").order("inventory_item_id").range(from, to),
    );
    for (const c of consumption) used[c.inventory_item_id] = (used[c.inventory_item_id] ?? 0) + Number(c.qty);
  } catch {
    stockTracked = false;
  }
  return { rows, available: true, used, stockTracked };
}

