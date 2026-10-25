export const INVENTORY_KINDS = ["materiale", "attrezzatura"] as const;
export type InventoryKind = (typeof INVENTORY_KINDS)[number];

export const INVENTORY_KIND_LABELS: Record<InventoryKind, string> = {
  materiale: "Materiale di consumo",
  attrezzatura: "Attrezzatura (acquisto una tantum)",
};

export interface InventoryRow {
  id: string;
  kind: InventoryKind;
  name: string;
  total_cost_cents: number;
  quantity: number;
  per_item_qty: number;
  in_use: boolean;
  purchased_at: string;
  notes: string | null;
}

/** Costo di una singola unità, in centesimi (può avere decimali: 0,10 € = 10). */
export function unitCostCents(row: Pick<InventoryRow, "total_cost_cents" | "quantity">): number {
  return row.quantity > 0 ? row.total_cost_cents / row.quantity : 0;
}

/** Quanto costa questo materiale a ogni capo, in centesimi (decimali ammessi). */
export function perItemCostCents(row: InventoryRow): number {
  return unitCostCents(row) * row.per_item_qty;
}

/**
 * Costo dei materiali per capo: somma dei materiali «in uso», arrotondata al centesimo.
 * Stessa formula di record_sale nel database, che lo congela su ogni vendita.
 */
export function materialsCostPerItem(rows: InventoryRow[]): number {
  const sum = rows.filter((r) => r.kind === "materiale" && r.in_use).reduce((t, r) => t + perItemCostCents(r), 0);
  return Math.round(sum);
}

/** Totale speso in attrezzature (investimenti da recuperare, fuori dal costo dei capi). */
export function investmentsTotal(rows: InventoryRow[]): number {
  return rows.filter((r) => r.kind === "attrezzatura").reduce((t, r) => t + r.total_cost_cents, 0);
}

/** Pezzi rimasti di un materiale: acquistati meno consumati dalle vendite (mai sotto zero). */
export function remainingQty(row: Pick<InventoryRow, "quantity">, used: number): number {
  return Math.max(0, Math.round((row.quantity - used) * 1000) / 1000);
}

/** Un numero di pezzi in italiano, senza decimali inutili (99 · 12,5). */
export function formatQty(n: number): string {
  return n.toLocaleString("it-IT", { maximumFractionDigits: 3 });
}

const unitFmt = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 2, maximumFractionDigits: 3 });

/** Un importo in centesimi con fino a 3 decimali in euro (serve per i costi unitari: 0,083 €). */
export function formatUnitEuro(cents: number): string {
  return unitFmt.format(cents / 100);
}
