import { allocatedItemCost, lotTotalCost, saleNetRevenue } from "@/lib/metrics";
import { toMetricLot, toMetricSale } from "./mappers";
import type { ItemRow, LotRow, SaleRow } from "./types";

function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

function daysBetween(from: string, to: string): number | null {
  const a = dayNumber(from);
  const b = dayNumber(to);
  return a !== null && b !== null && b >= a ? b - a : null;
}

export interface LotStatsRow {
  lot: LotRow;
  registered: number;
  sold: number;
  returned: number;
  inStock: number;
  totalCost: number;
  /** Incassi lordi dei capi venduti. */
  revenue: number;
  /** Incassi meno commissioni, spedizione e extra. */
  netRevenue: number;
  /** Profitto dei capi venduti (netto − costo attribuito). */
  profit: number;
  /** Incassi netti − costo dell'intero lotto. Negativo finché il lotto non è rientrato. */
  cashBalance: number;
  /** Quanta parte del costo del lotto è già rientrata, in punti base (10000 = 100%). null se il costo è 0. */
  recoveredBp: number | null;
  /** Margine = profitto / incassi, in punti base. null se non ci sono incassi. */
  marginBp: number | null;
  avgDays: number | null;
}

export function computeLotStats(lots: LotRow[], items: ItemRow[], sales: SaleRow[]): LotStatsRow[] {
  const saleByItem = new Map(sales.map((s) => [s.item_id, s]));
  const itemsByLot = new Map<string, ItemRow[]>();
  for (const i of items) {
    const list = itemsByLot.get(i.lot_id) ?? [];
    list.push(i);
    itemsByLot.set(i.lot_id, list);
  }

  return lots.map((lot) => {
    const metricLot = toMetricLot(lot);
    const unitCost = allocatedItemCost(metricLot);
    const own = itemsByLot.get(lot.id) ?? [];
    let sold = 0;
    let returned = 0;
    let revenue = 0;
    let netRevenue = 0;
    const days: number[] = [];
    for (const item of own) {
      if (item.status === "reso") returned += 1;
      const sale = saleByItem.get(item.id);
      if (item.status === "venduto" && sale) {
        sold += 1;
        revenue += sale.price_cents;
        netRevenue += saleNetRevenue(toMetricSale(sale));
        const d = daysBetween(lot.purchased_at, sale.sold_at);
        if (d !== null) days.push(d);
      }
    }
    const totalCost = lotTotalCost(metricLot);
    const profit = netRevenue - sold * unitCost;
    return {
      lot,
      registered: own.length,
      sold,
      returned,
      inStock: own.length - sold - returned,
      totalCost,
      revenue,
      netRevenue,
      profit,
      cashBalance: netRevenue - totalCost,
      recoveredBp: totalCost > 0 ? Math.round((netRevenue / totalCost) * 10000) : null,
      marginBp: revenue > 0 ? Math.round((profit / revenue) * 10000) : null,
      avgDays: days.length > 0 ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null,
    };
  });
}

export interface ItemStatsRow {
  item: ItemRow;
  sale: SaleRow | null;
  cost: number;
  /** null se il capo non è venduto. */
  profit: number | null;
  days: number | null;
}

/** Statistiche dei singoli capi di un lotto. */
export function computeItemStats(lot: LotRow, items: ItemRow[], sales: SaleRow[]): ItemStatsRow[] {
  const saleByItem = new Map(sales.map((s) => [s.item_id, s]));
  const cost = allocatedItemCost(toMetricLot(lot));
  return items
    .filter((i) => i.lot_id === lot.id)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((item) => {
      const sale = saleByItem.get(item.id) ?? null;
      const isSold = item.status === "venduto" && sale !== null;
      return {
        item,
        sale: isSold ? sale : null,
        cost,
        profit: isSold ? saleNetRevenue(toMetricSale(sale)) - cost : null,
        days: isSold ? daysBetween(lot.purchased_at, sale.sold_at) : null,
      };
    });
}
