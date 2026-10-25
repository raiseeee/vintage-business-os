import type { ITEM_CONDITIONS, ITEM_STATUSES } from "./constants";

/** Righe del database (nomi delle colonne come in SQL). */
export interface LotRow {
  id: string;
  supplier_id: string;
  code: string;
  purchased_at: string;
  purchase_cost_cents: number;
  inbound_shipping_cents: number;
  other_costs_cents: number;
  quantity: number;
  weight_kg: number | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface ItemRow {
  id: string;
  lot_id: string;
  code: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  condition: (typeof ITEM_CONDITIONS)[number] | null;
  status: (typeof ITEM_STATUSES)[number];
  expected_price_cents: number | null;
  /** Dove è stato messo in vendita (assente finché non si applica la migrazione della pubblicazione). */
  listing_channel?: string | null;
  listed_at?: string | null;
  notes: string | null;
  is_demo: boolean;
  created_at: string;
}

export interface SaleRow {
  id: string;
  item_id: string;
  channel: string;
  sold_at: string;
  price_cents: number;
  fees_cents: number;
  outbound_shipping_cents: number;
  extra_costs_cents: number;
  /** Materiali per capo congelati alla vendita (assente finché non si applica la migrazione dell'inventario). */
  materials_cost_cents?: number;
  notes: string | null;
}

export interface PhotoRow {
  id: string;
  item_id: string;
  storage_path: string;
  position: number;
}

export interface SupplierName {
  id: string;
  name: string;
}

/** Tutti i dati dell'attività, letti in una volta (uso personale, qualche migliaio di righe al massimo). */
export interface BusinessData {
  suppliers: SupplierName[];
  lots: LotRow[];
  items: ItemRow[];
  sales: SaleRow[];
}
