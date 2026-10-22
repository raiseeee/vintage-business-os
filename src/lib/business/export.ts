import { toCsv, type CsvCell } from "@/lib/csv";
import {
  allocatedItemCost,
  computeDashboard,
  itemProfit,
  saleNetRevenue,
  lotTotalCost,
} from "@/lib/metrics";
import { ITEM_CONDITION_LABELS, ITEM_STATUS_LABELS } from "./constants";
import { toMetricItems, toMetricLot, toMetricSale } from "./mappers";
import type { BusinessData } from "./types";

export type ExportKind = "capi" | "lotti" | "vendite";
export const EXPORT_KINDS: ExportKind[] = ["capi", "lotti", "vendite"];

const yesNo = (v: boolean) => (v ? "sì" : "no");

function lookups(data: BusinessData) {
  return {
    supplierName: new Map(data.suppliers.map((s) => [s.id, s.name])),
    lotById: new Map(data.lots.map((l) => [l.id, l])),
    saleByItem: new Map(data.sales.map((s) => [s.item_id, s])),
    metricItems: new Map(toMetricItems(data.items, data.sales).map((i) => [i.id, i])),
  };
}

export function buildLotsCsv(data: BusinessData): string {
  const { supplierName } = lookups(data);
  const metricItems = toMetricItems(data.items, data.sales);

  const header = [
    "Codice lotto", "Fornitore", "Data acquisto", "Quantità dichiarata", "Capi registrati",
    "Merce (€)", "Spedizione in entrata (€)", "Altri costi (€)", "Costo totale (€)", "Costo per capo (€)",
    "Peso (kg)", "Capi venduti", "Incassi (€)", "Costi di vendita (€)", "Margine realizzato (€)",
    "Saldo cassa (€)", "Demo", "Note",
  ];

  const rows: CsvCell[][] = [...data.lots]
    .sort((a, b) => a.purchased_at.localeCompare(b.purchased_at) || a.code.localeCompare(b.code))
    .map((lot) => {
      const ml = toMetricLot(lot);
      const items = metricItems.filter((i) => i.lotId === lot.id);
      const m = computeDashboard([ml], items);
      return [
        lot.code,
        supplierName.get(lot.supplier_id) ?? "",
        lot.purchased_at,
        lot.quantity,
        items.length,
        { cents: lot.purchase_cost_cents },
        { cents: lot.inbound_shipping_cents },
        { cents: lot.other_costs_cents },
        { cents: lotTotalCost(ml) },
        { cents: allocatedItemCost(ml) },
        lot.weight_kg,
        m.soldCount,
        { cents: m.salesRevenue },
        { cents: m.saleCosts },
        { cents: m.realizedMargin },
        { cents: m.cashBalance },
        yesNo(lot.is_demo),
        lot.notes,
      ];
    });

  return toCsv(header, rows);
}

export function buildItemsCsv(data: BusinessData): string {
  const { supplierName, lotById, saleByItem, metricItems } = lookups(data);

  const header = [
    "Codice capo", "Lotto", "Fornitore", "Marca", "Categoria", "Taglia", "Condizione", "Stato",
    "Prezzo previsto (€)", "Costo attribuito (€)", "Canale", "Data vendita", "Prezzo incassato (€)",
    "Commissioni (€)", "Spedizione in uscita (€)", "Costi extra (€)", "Ricavo netto (€)", "Profitto (€)",
    "Demo", "Note",
  ];

  const rows: CsvCell[][] = [...data.items]
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((item) => {
      const lot = lotById.get(item.lot_id)!;
      const ml = toMetricLot(lot);
      const sale = saleByItem.get(item.id);
      const profit = itemProfit(metricItems.get(item.id)!, ml);
      const net = sale ? saleNetRevenue(toMetricSale(sale)) : null;
      return [
        item.code,
        lot.code,
        supplierName.get(lot.supplier_id) ?? "",
        item.brand,
        item.category,
        item.size,
        item.condition ? ITEM_CONDITION_LABELS[item.condition] : null,
        ITEM_STATUS_LABELS[item.status],
        item.expected_price_cents !== null ? { cents: item.expected_price_cents } : null,
        { cents: allocatedItemCost(ml) },
        sale?.channel ?? null,
        sale?.sold_at ?? null,
        sale ? { cents: sale.price_cents } : null,
        sale ? { cents: sale.fees_cents } : null,
        sale ? { cents: sale.outbound_shipping_cents } : null,
        sale ? { cents: sale.extra_costs_cents } : null,
        net !== null ? { cents: net } : null,
        profit !== null ? { cents: profit } : null,
        yesNo(item.is_demo),
        item.notes,
      ];
    });

  return toCsv(header, rows);
}

export function buildSalesCsv(data: BusinessData): string {
  const { supplierName, lotById, metricItems } = lookups(data);
  const itemById = new Map(data.items.map((i) => [i.id, i]));

  const header = [
    "Data vendita", "Codice capo", "Lotto", "Fornitore", "Stato capo", "Canale", "Prezzo incassato (€)",
    "Commissioni (€)", "Spedizione in uscita (€)", "Costi extra (€)", "Ricavo netto (€)",
    "Costo attribuito (€)", "Profitto (€)", "Note",
  ];

  const rows: CsvCell[][] = [...data.sales]
    .sort((a, b) => a.sold_at.localeCompare(b.sold_at))
    .map((sale) => {
      const item = itemById.get(sale.item_id)!;
      const lot = lotById.get(item.lot_id)!;
      const ml = toMetricLot(lot);
      const profit = itemProfit(metricItems.get(item.id)!, ml);
      return [
        sale.sold_at,
        item.code,
        lot.code,
        supplierName.get(lot.supplier_id) ?? "",
        ITEM_STATUS_LABELS[item.status],
        sale.channel,
        { cents: sale.price_cents },
        { cents: sale.fees_cents },
        { cents: sale.outbound_shipping_cents },
        { cents: sale.extra_costs_cents },
        { cents: saleNetRevenue(toMetricSale(sale)) },
        { cents: allocatedItemCost(ml) },
        // Un capo reso non ha profitto: la vendita non conta nei ricavi.
        profit !== null ? { cents: profit } : null,
        sale.notes,
      ];
    });

  return toCsv(header, rows);
}

export function buildCsv(kind: ExportKind, data: BusinessData): string {
  switch (kind) {
    case "capi":
      return buildItemsCsv(data);
    case "lotti":
      return buildLotsCsv(data);
    case "vendite":
      return buildSalesCsv(data);
  }
}
