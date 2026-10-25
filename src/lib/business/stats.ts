import { allocatedItemCost, saleNetRevenue } from "@/lib/metrics";
import { toMetricLot, toMetricSale } from "./mappers";
import type { ItemRow, LotRow, SaleRow } from "./types";

export const GROUP_KEYS = ["marca", "categoria", "lotto", "canale"] as const;
export type GroupKey = (typeof GROUP_KEYS)[number];

export const GROUP_LABELS: Record<GroupKey, string> = {
  marca: "Marca",
  categoria: "Categoria",
  lotto: "Lotto",
  canale: "Canale di vendita",
};

/** Sotto questo numero di vendite il dato è solo indicativo. */
export const SMALL_SAMPLE = 5;

export interface GroupStats {
  label: string;
  /** Capi registrati (resi esclusi). Per il canale non ha senso: è null. */
  registered: number | null;
  sold: number;
  /** Venduti / registrati, in centesimi di punto percentuale; null se non calcolabile. */
  sellThroughBp: number | null;
  revenue: number;
  profit: number;
  avgProfit: number;
  /** Profitto / incassi, in centesimi di punto percentuale; null se incassi = 0. */
  marginBp: number | null;
  /** Giorni medi dall'acquisto del lotto alla vendita; null se nessuna data valida. */
  avgDays: number | null;
  smallSample: boolean;
}

const NONE = "(non indicata)";

function dayNumber(iso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  return Math.floor(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / 86_400_000);
}

/**
 * Statistiche sulle TUE vendite reali, raggruppate per marca, categoria, lotto o canale.
 * Nessuna stima: solo capi venduti con la loro vendita registrata.
 * Giorni per vendere = data vendita − data di acquisto del lotto (non esiste una data di pubblicazione).
 */
export function computeGroupStats(
  key: GroupKey,
  lots: LotRow[],
  items: ItemRow[],
  sales: SaleRow[],
): GroupStats[] {
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const saleByItem = new Map(sales.map((s) => [s.item_id, s]));

  const labelOf = (item: ItemRow, sale: SaleRow | undefined): string => {
    switch (key) {
      case "marca":
        return item.brand?.trim() || NONE;
      case "categoria":
        return item.category?.trim() || NONE;
      case "lotto":
        return lotById.get(item.lot_id)?.code ?? NONE;
      case "canale":
        return sale?.channel.trim() || NONE;
    }
  };

  interface Acc { label: string; registered: number; sold: number; revenue: number; profit: number; days: number[] }
  const groups = new Map<string, Acc>();
  const get = (label: string): Acc => {
    // Marche e categorie si raggruppano senza badare a maiuscole (Nike = nike).
    const id = label.toLowerCase();
    let g = groups.get(id);
    if (!g) groups.set(id, (g = { label, registered: 0, sold: 0, revenue: 0, profit: 0, days: [] }));
    return g;
  };

  for (const item of items) {
    if (item.status === "reso") continue;
    const sale = item.status === "venduto" ? saleByItem.get(item.id) : undefined;
    const g = get(labelOf(item, sale));
    g.registered += 1;

    if (sale) {
      const lot = lotById.get(item.lot_id);
      g.sold += 1;
      g.revenue += sale.price_cents;
      g.profit += saleNetRevenue(toMetricSale(sale)) - (lot ? allocatedItemCost(toMetricLot(lot)) : 0);
      const from = lot ? dayNumber(lot.purchased_at) : null;
      const to = dayNumber(sale.sold_at);
      if (from !== null && to !== null && to >= from) g.days.push(to - from);
    }
  }

  return [...groups.values()]
    .filter((g) => g.sold > 0)
    .map((g) => ({
      label: g.label,
      registered: key === "canale" ? null : g.registered,
      sold: g.sold,
      sellThroughBp: key === "canale" || g.registered === 0 ? null : Math.round((g.sold * 10_000) / g.registered),
      revenue: g.revenue,
      profit: g.profit,
      avgProfit: Math.round(g.profit / g.sold),
      marginBp: g.revenue > 0 ? Math.round((g.profit * 10_000) / g.revenue) : null,
      avgDays: g.days.length > 0 ? Math.round(g.days.reduce((a, b) => a + b, 0) / g.days.length) : null,
      smallSample: g.sold < SMALL_SAMPLE,
    }))
    .sort((a, b) => b.profit - a.profit || a.label.localeCompare(b.label));
}
