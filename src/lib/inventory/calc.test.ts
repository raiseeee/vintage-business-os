import { describe, expect, it } from "vitest";
import { formatUnitEuro, investmentsTotal, materialsCostPerItem, unitCostCents, type InventoryRow } from "./calc";

const row = (o: Partial<InventoryRow>): InventoryRow => ({
  id: "x", kind: "materiale", name: "x", total_cost_cents: 1000, quantity: 100, per_item_qty: 1, in_use: true,
  purchased_at: "2026-10-01", notes: null, ...o,
});

describe("inventario", () => {
  it("100 sacchetti a 10 € = 0,10 € l'uno", () => expect(unitCostCents(row({}))).toBe(10));
  it("somma solo i materiali in uso, con la quantità per capo", () => {
    const rows = [row({}), row({ name: "scatole", total_cost_cents: 3000, quantity: 50, per_item_qty: 0.5 }), row({ in_use: false, total_cost_cents: 99999 })];
    expect(materialsCostPerItem(rows)).toBe(40); // 10 + 30
  });
  it("le attrezzature non entrano nel costo per capo ma negli investimenti", () => {
    const rows = [row({}), row({ kind: "attrezzatura", total_cost_cents: 20000, quantity: 1, per_item_qty: 0, in_use: false })];
    expect(materialsCostPerItem(rows)).toBe(10);
    expect(investmentsTotal(rows)).toBe(20000);
  });
  it("arrotonda al centesimo il costo per capo", () => expect(materialsCostPerItem([row({ total_cost_cents: 100, quantity: 30 })])).toBe(3));
  it("nessun materiale: zero", () => expect(materialsCostPerItem([])).toBe(0));
  it("mostra fino a 3 decimali per i costi unitari", () => {
    expect(formatUnitEuro(10).replace(/\s/g, " ")).toContain("0,10");
    expect(formatUnitEuro(8.3)).toContain("0,083");
  });
});

import { inventorySchema } from "./schemas";

describe("inventorySchema", () => {
  const base = { kind: "materiale", name: "Sacchetti", total_cost_cents: "10,00", quantity: "100", per_item_qty: "1", in_use: "si", purchased_at: "2026-10-01", notes: "" };
  it("accetta un materiale in uso", () => {
    const r = inventorySchema.safeParse(base);
    expect(r.success && r.data).toMatchObject({ total_cost_cents: 1000, quantity: 100, per_item_qty: 1, in_use: true, notes: null });
  });
  it("accetta la virgola nella quantità per capo", () => {
    const r = inventorySchema.safeParse({ ...base, per_item_qty: "0,5" });
    expect(r.success && r.data.per_item_qty).toBe(0.5);
  });
  it("un'attrezzatura non è mai «in uso» né ha quantità per capo", () => {
    const r = inventorySchema.safeParse({ ...base, kind: "attrezzatura", total_cost_cents: "200", quantity: "1" });
    expect(r.success && r.data).toMatchObject({ per_item_qty: 0, in_use: false });
  });
  it("rifiuta nome vuoto, quantità zero, importo non valido, quantità per capo negativa", () => {
    expect(inventorySchema.safeParse({ ...base, name: " " }).success).toBe(false);
    expect(inventorySchema.safeParse({ ...base, quantity: "0" }).success).toBe(false);
    expect(inventorySchema.safeParse({ ...base, total_cost_cents: "abc" }).success).toBe(false);
    expect(inventorySchema.safeParse({ ...base, per_item_qty: "-1" }).success).toBe(false);
  });
});
