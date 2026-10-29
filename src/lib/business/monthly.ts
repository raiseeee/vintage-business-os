import { itemProfit, lotTotalCost } from "@/lib/metrics";
import { toMetricItems, toMetricLot } from "./mappers";
import type { BusinessData } from "./types";

/** «2026-10» da una data AAAA-MM-GG. */
export function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

/** Mese a distanza di `delta` mesi da «AAAA-MM» (anche negativo). */
export function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split("-").map(Number);
  const index = y * 12 + (m - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

/** Nome del mese in italiano, minuscolo («ottobre»). */
export function monthName(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("it-IT", { month: "long", timeZone: "UTC" });
}

/** Nome breve per l'asse dei grafici («ott»). */
export function monthShort(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("it-IT", { month: "short", timeZone: "UTC" }).replace(".", "");
}

export interface MonthTotals {
  key: string;
  /** Incasso lordo dei capi venduti nel mese. */
  sales: number;
  /** Margine realizzato: ricavo netto meno costo attribuito, sui capi venduti nel mese. */
  margin: number;
  /** Capi venduti nel mese. */
  sold: number;
  /** Costo totale dei lotti acquistati nel mese. */
  spent: number;
}

/** Totali per mese, dal più vecchio al più recente, finendo con `endKey`. */
export function monthlyTotals(data: BusinessData, endKey: string, months: number): MonthTotals[] {
  const keys = Array.from({ length: months }, (_, i) => shiftMonth(endKey, i - (months - 1)));
  const byKey = new Map<string, MonthTotals>(keys.map((key) => [key, { key, sales: 0, margin: 0, sold: 0, spent: 0 }]));

  const lots = data.lots.map(toMetricLot);
  const lotById = new Map(lots.map((l) => [l.id, l]));
  for (const row of data.lots) {
    const t = byKey.get(monthKey(row.purchased_at));
    if (t) t.spent += lotTotalCost(lotById.get(row.id)!);
  }

  const items = toMetricItems(data.items, data.sales);
  const itemById = new Map(items.map((i) => [i.id, i]));
  for (const sale of data.sales) {
    const t = byKey.get(monthKey(sale.sold_at));
    const item = itemById.get(sale.item_id);
    if (!t || !item) continue;
    const lot = lotById.get(item.lotId);
    const profit = lot ? itemProfit(item, lot) : null;
    if (profit === null) continue; // venduti soltanto: i resi non contano
    t.sales += sale.price_cents;
    t.margin += profit;
    t.sold += 1;
  }
  return keys.map((k) => byKey.get(k)!);
}

/**
 * Variazione rispetto al mese precedente. Se prima era zero la percentuale non ha senso: resta solo la differenza.
 */
export function compare(current: number, previous: number): { diff: number; percent: number | null } {
  const diff = current - previous;
  if (previous === 0) return { diff, percent: null };
  return { diff, percent: Math.round((diff / Math.abs(previous)) * 100) };
}

