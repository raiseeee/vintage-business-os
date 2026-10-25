import { describe, expect, it } from "vitest";
import { computeItemStats, computeLotStats } from "./lotStats";
import type { ItemRow, LotRow, SaleRow } from "./types";

const lot = {
  id: "l1", supplier_name: null, code: "L1", purchased_at: "2026-10-01",
  purchase_cost_cents: 8000, inbound_shipping_cents: 1500, other_costs_cents: 500, quantity: 10,
  weight_kg: null, notes: null, created_at: "",
} as LotRow;
const item = (id: string, status: ItemRow["status"], lot_id = "l1") =>
  ({ id, lot_id, code: id, status, brand: null, category: null, size: null, condition: null, expected_price_cents: null, notes: null, created_at: "" }) as ItemRow;
const sale = (item_id: string, price: number, sold_at = "2026-10-11"): SaleRow =>
  ({ id: "s" + item_id, item_id, channel: "Vinted", sold_at, price_cents: price, fees_cents: 200, outbound_shipping_cents: 300, extra_costs_cents: 0, notes: null });

describe("computeLotStats", () => {
  const items = [item("a", "venduto"), item("b", "venduto"), item("c", "pronto"), item("d", "reso"), item("x", "venduto", "altro")];
  const sales = [sale("a", 4000), sale("b", 3000, "2026-10-21"), sale("x", 9999)];
  const [row] = computeLotStats([lot], items, sales);

  it("conta i capi per stato", () => {
    expect(row.registered).toBe(4);
    expect(row.sold).toBe(2);
    expect(row.returned).toBe(1);
    expect(row.inStock).toBe(1);
  });
  it("calcola incassi, profitto e rientro", () => {
    expect(row.totalCost).toBe(10000);
    expect(row.revenue).toBe(7000);
    expect(row.netRevenue).toBe(6000); // 7000 - 2*(200+300)
    expect(row.profit).toBe(4000); // 6000 - 2*1000
    expect(row.cashBalance).toBe(-4000);
    expect(row.recoveredBp).toBe(6000);
    expect(row.marginBp).toBe(5714);
  });
  it("giorni medi dall'acquisto alla vendita", () => expect(row.avgDays).toBe(15)); // 10 e 20
  it("lotto senza capi: tutto a zero, senza errori", () => {
    const [r] = computeLotStats([lot], [], []);
    expect(r.registered).toBe(0);
    expect(r.marginBp).toBeNull();
    expect(r.avgDays).toBeNull();
    expect(r.cashBalance).toBe(-10000);
  });
});

describe("computeItemStats", () => {
  it("profitto solo per i venduti, costo del lotto diviso i capi dichiarati", () => {
    const rows = computeItemStats(lot, [item("b", "venduto"), item("a", "pronto"), item("z", "venduto", "altro")], [sale("b", 4000)]);
    expect(rows.map((r) => r.item.id)).toEqual(["a", "b"]);
    expect(rows[0].profit).toBeNull();
    expect(rows[1].cost).toBe(1000);
    expect(rows[1].profit).toBe(2500); // 4000-200-300-1000
    expect(rows[1].days).toBe(10);
  });
});
