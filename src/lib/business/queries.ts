import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getSuppliers } from "@/lib/suppliers/queries";
import { PHOTO_BUCKET } from "./constants";
import { fetchAll } from "./paginate";
import type { BusinessData, ItemRow, LotRow, PhotoRow, SaleRow } from "./types";

/** Tutti i dati dell'attività: bastano per dashboard, liste ed esportazioni (uso personale). */
export async function getBusinessData(): Promise<BusinessData> {
  const supabase = await createClient();

  const [lots, items, sales, { rows: suppliers }] = await Promise.all([
    fetchAll<LotRow>((from, to) =>
      supabase.from("purchase_lots").select("*").order("id").range(from, to),
    ),
    fetchAll<ItemRow>((from, to) =>
      supabase.from("items").select("*").order("id").range(from, to),
    ),
    fetchAll<SaleRow>((from, to) =>
      supabase.from("sales").select("*").order("id").range(from, to),
    ),
    getSuppliers(),
  ]);

  // Il nome del fornitore sta nella sua tabella: lo si riporta sui lotti per liste, statistiche ed esportazioni.
  const names = new Map(suppliers.map((s) => [s.id, s.name]));
  for (const l of lots) l.supplier_name = l.supplier_id ? (names.get(l.supplier_id) ?? null) : null;

  return { lots, items, sales };
}

export async function getItem(id: string): Promise<ItemRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("items").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Impossibile caricare il capo");
  return (data as ItemRow | null) ?? null;
}

export async function getSaleForItem(itemId: string): Promise<SaleRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sales").select("*").eq("item_id", itemId).maybeSingle();
  if (error) throw new Error("Impossibile caricare la vendita");
  return (data as SaleRow | null) ?? null;
}

export async function getLot(id: string): Promise<LotRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("purchase_lots").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Impossibile caricare il lotto");
  const lot = (data as LotRow | null) ?? null;
  if (lot) {
    lot.supplier_name = null;
    if (lot.supplier_id) {
      const { data: s } = await supabase.from("suppliers").select("name").eq("id", lot.supplier_id).maybeSingle();
      lot.supplier_name = (s?.name as string | undefined) ?? null;
    }
  }
  return lot;
}

export interface PhotoWithUrl extends PhotoRow {
  url: string | null;
}

/** Foto di un capo con link temporanei (il bucket è privato). */
export async function getItemPhotos(itemId: string): Promise<PhotoWithUrl[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("item_photos")
    .select("id, item_id, storage_path, position")
    .eq("item_id", itemId)
    .order("position")
    .order("created_at");
  if (error) throw new Error("Impossibile caricare le foto");

  const rows = (data ?? []) as PhotoRow[];
  if (rows.length === 0) return [];

  const { data: signed } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(
      rows.map((r) => r.storage_path),
      3600,
    );
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return rows.map((r) => ({ ...r, url: urlByPath.get(r.storage_path) ?? null }));
}

/** Prima foto di ciascun capo (per le miniature nelle liste). */
export async function getFirstPhotoUrls(itemIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (itemIds.length === 0) return result;

  const supabase = await createClient();
  const rows = await fetchAll<PhotoRow>((from, to) =>
    supabase
      .from("item_photos")
      .select("id, item_id, storage_path, position")
      .order("id")
      .range(from, to),
  );

  const wanted = new Set(itemIds);
  const first = new Map<string, PhotoRow>();
  for (const r of rows.sort((a, b) => a.position - b.position)) {
    if (wanted.has(r.item_id) && !first.has(r.item_id)) first.set(r.item_id, r);
  }
  if (first.size === 0) return result;

  const paths = [...first.values()].map((r) => r.storage_path);
  const { data: signed } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  for (const [itemId, row] of first) {
    const url = urlByPath.get(row.storage_path);
    if (url) result.set(itemId, url);
  }
  return result;
}

export async function getLotCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("purchase_lots")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error("Impossibile contare i lotti");
  return count ?? 0;
}
