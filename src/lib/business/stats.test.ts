import { describe, expect, it } from "vitest";
import { computeGroupStats } from "./stats";
import type { ItemRow, LotRow, SaleRow } from "./types";

const lot = (id: string, code: string, cost: number, qty: number, at = "2026-01-01"): LotRow => ({
  id, supplier_id: "s", code, purchased_at: at, purchase_cost_cents: cost, inbound_shipping_cents: 0,
  other_costs_cents: 0, quantity: qty, weight_kg: null, notes: null, is_demo: false, created_at: "",
});
const item = (id: string, lot_id: string, brand: string | null, status: ItemRow["status"]): ItemRow => ({
  id, lot_id, code: id, brand, category: "Felpa", size: null, condition: null, status,
  expected_price_cents: null, notes: null, is_demo: false, created_at: "",
});
const sale = (item_id: string, price: number, fees: number, sold_at: string, channel = "Vinted"): SaleRow => ({
  id: item_id, item_id, channel, sold_at, price_cents: price, fees_cents: fees,
  outbound_shipping_cents: 0, extra_costs_cents: 0, notes: null,
});

describe("computeGroupStats", () => {
  // Lotto da 100 € per 10 capi → costo attribuito 10 € a capo.
  const lots = [lot("L1", "L-001", 10000, 10)];
  const items = [
    item("a", "L1", "Nike", "venduto"),
    item("b", "L1", "nike", "venduto"),
    item("c", "L1", "Nike", "pubblicato"),
    item("d", "L1", "Adidas", "venduto"),
    item("e", "L1", "Adidas", "reso"),
    item("f", "L1", null, "pronto"),
  ];
  const sales = [
    sale("a", 3000, 300, "2026-01-11"), // netto 27 − costo 10 = 17 €, 10 giorni
    sale("b", 2000, 0, "2026-01-21"), // 20 − 10 = 10 €, 20 giorni
    sale("d", 1500, 0, "2026-01-06"), // 15 − 10 = 5 €, 5 giorni
  ];

  it("raggruppa per marca senza badare alle maiuscole e calcola le medie", () => {
    const r = computeGroupStats("marca", lots, items, sales);
    const nike = r.find((g) => g.label.toLowerCase() === "nike")!;
    expect(nike.sold).toBe(2);
    expect(nike.registered).toBe(3);
    expect(nike.sellThroughBp).toBe(6667);
    expect(nike.revenue).toBe(5000);
    expect(nike.profit).toBe(2700);
    expect(nike.avgProfit).toBe(1350);
    expect(nike.marginBp).toBe(5400);
    expect(nike.avgDays).toBe(15);
    expect(nike.smallSample).toBe(true);
  });

  it("i resi non contano tra i capi registrati e i gruppi senza vendite non compaiono", () => {
    const r = computeGroupStats("marca", lots, items, sales);
    expect(r.find((g) => g.label === "Adidas")!.registered).toBe(1);
    expect(r.some((g) => g.label === "(non indicata)")).toBe(false);
  });

  it("ordina per profitto e il canale non ha tasso di vendita", () => {
    const byBrand = computeGroupStats("marca", lots, items, sales);
    expect(byBrand[0].label.toLowerCase()).toBe("nike");
    const byChannel = computeGroupStats("canale", lots, items, sales);
    expect(byChannel).toHaveLength(1);
    expect(byChannel[0].sold).toBe(3);
    expect(byChannel[0].sellThroughBp).toBeNull();
  });

  it("senza vendite non restituisce nulla", () => {
    expect(computeGroupStats("lotto", lots, items, [])).toEqual([]);
  });

  it("una data di vendita precedente all'acquisto non entra nei giorni medi", () => {
    const r = computeGroupStats("lotto", lots, [item("x", "L1", "Nike", "venduto")], [sale("x", 2000, 0, "2025-12-01")]);
    expect(r[0].avgDays).toBeNull();
  });
});
