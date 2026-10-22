import "server-only";
import { createClient } from "@/lib/supabase/server";
import { PHOTO_BUCKET } from "./constants";
import { fetchAll } from "./paginate";
import type { BusinessData, ItemRow, LotRow, PhotoRow, SaleRow, SupplierName } from "./types";

/** Tutti i dati dell'attività: bastano per dashboard, liste ed esportazioni (uso personale). */
export async function getBusinessData(): Promise<BusinessData> {
  const supabase = await createClient();

  const [suppliers, lots, items, sales] = await Promise.all([
    fetchAll<SupplierName>((from, to) =>
      supabase.from("suppliers").select("id, name").order("id").range(from, to),
    ),
    fetchAll<LotRow>((from, to) =>
      supabase.from("purchase_lots").select("*").order("id").range(from, to),
    ),
    fetchAll<ItemRow>((from, to) =>
      supabase.from("items").select("*").order("id").range(from, to),
    ),
    fetchAll<SaleRow>((from, to) =>
      supabase.from("sales").select("*").order("id").range(from, to),
    ),
  ]);

  return { suppliers, lots, items, sales };
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
  return (data as LotRow | null) ?? null;
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

/** Elenco dei fornitori (id e nome) in ordine alfabetico, per i menu di scelta. */
export async function getSupplierNames(): Promise<SupplierName[]> {
  const supabase = await createClient();
  return fetchAll<SupplierName>((from, to) =>
    supabase.from("suppliers").select("id, name").order("name").order("id").range(from, to),
  );
}

export async function getLotCount(): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("purchase_lots")
    .select("id", { count: "exact", head: true });
  if (error) throw new Error("Impossibile contare i lotti");
  return count ?? 0;
}
