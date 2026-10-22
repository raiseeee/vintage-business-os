import type { Item, Lot, Sale } from "@/lib/metrics";
import type { ItemRow, LotRow, SaleRow } from "./types";

/** Da riga del database a input dei calcoli (tutti importi in centesimi). */
export function toMetricLot(row: LotRow): Lot {
  return {
    id: row.id,
    supplierId: row.supplier_id,
    purchaseCost: row.purchase_cost_cents,
    inboundShipping: row.inbound_shipping_cents,
    otherCosts: row.other_costs_cents,
    quantity: row.quantity,
  };
}

export function toMetricSale(row: SaleRow): Sale {
  return {
    price: row.price_cents,
    fees: row.fees_cents,
    outboundShipping: row.outbound_shipping_cents,
    extraCosts: row.extra_costs_cents,
  };
}

export function toMetricItems(items: ItemRow[], sales: SaleRow[]): Item[] {
  const saleByItem = new Map(sales.map((s) => [s.item_id, s]));
  return items.map((row) => {
    const sale = saleByItem.get(row.id);
    return {
      id: row.id,
      lotId: row.lot_id,
      status: row.status,
      expectedPrice: row.expected_price_cents,
      sale: sale ? toMetricSale(sale) : null,
    };
  });
}
