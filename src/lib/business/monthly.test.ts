import { describe, expect, it } from "vitest";
import { compare, monthKey, monthName, monthShort, monthlyTotals, shiftMonth } from "./monthly";
import type { BusinessData } from "./types";

describe("mesi", () => {
  it("ricava e sposta il mese, anche a cavallo d'anno", () => {
    expect(monthKey("2026-10-29")).toBe("2026-10");
    expect(shiftMonth("2026-10", -1)).toBe("2026-09");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-03", -14)).toBe("2025-01");
  });
  it("nomi in italiano, in minuscolo", () => {
    expect(monthName("2026-10")).toBe("ottobre");
    expect(monthShort("2026-09")).toMatch(/^set/);
  });
});

describe("compare", () => {
  it("differenza e percentuale", () => {
    expect(compare(120, 100)).toEqual({ diff: 20, percent: 20 });
    expect(compare(50, 100)).toEqual({ diff: -50, percent: -50 });
    expect(compare(0, 100)).toEqual({ diff: -100, percent: -100 });
  });
  it("senza mese precedente niente percentuale", () => {
    expect(compare(80, 0)).toEqual({ diff: 80, percent: null });
    expect(compare(0, 0)).toEqual({ diff: 0, percent: null });
  });
  it("con un mese precedente negativo la percentuale usa il valore assoluto", () => {
    expect(compare(-50, -100)).toEqual({ diff: 50, percent: 50 });
  });
});

const lot = (id: string, at: string, cost: number, qty: number) =>
  ({ id, code: id, purchased_at: at, purchase_cost_cents: cost, inbound_shipping_cents: 0, other_costs_cents: 0, quantity: qty, weight_kg: null, notes: null, created_at: "" }) as BusinessData["lots"][number];
const item = (id: string, lotId: string, status: string) =>
  ({ id, lot_id: lotId, code: id, brand: null, category: null, size: null, condition: null, status, expected_price_cents: null, notes: null, created_at: "" }) as BusinessData["items"][number];
const sale = (itemId: string, at: string, price: number) =>
  ({ id: `s-${itemId}`, item_id: itemId, channel: "Vinted", sold_at: at, price_cents: price, fees_cents: 0, outbound_shipping_cents: 0, extra_costs_cents: 0, notes: null, created_at: "" }) as BusinessData["sales"][number];

describe("monthlyTotals", () => {
  const data: BusinessData = {
    lots: [lot("L1", "2026-09-10", 10000, 10), lot("L2", "2026-10-02", 5000, 5)],
    items: [item("a", "L1", "venduto"), item("b", "L1", "venduto"), item("c", "L2", "venduto"), item("d", "L1", "reso")],
    sales: [sale("a", "2026-09-20", 3000), sale("b", "2026-10-03", 4000), sale("c", "2026-10-05", 2500), sale("d", "2026-10-06", 9999)],
  };

  it("somma vendite, margine, capi venduti e spesa per mese", () => {
    const [sep, oct] = monthlyTotals(data, "2026-10", 2);
    expect(sep).toMatchObject({ key: "2026-09", sales: 3000, margin: 3000 - 1000, sold: 1, spent: 10000 });
    expect(oct).toMatchObject({ key: "2026-10", sales: 6500, margin: 4000 - 1000 + (2500 - 1000), sold: 2, spent: 5000 });
  });
  it("i capi resi non contano", () => {
    expect(monthlyTotals(data, "2026-10", 1)[0].sold).toBe(2);
  });
  it("restituisce sempre il numero di mesi chiesto, anche vuoti, in ordine", () => {
    const t = monthlyTotals(data, "2026-10", 4);
    expect(t.map((m) => m.key)).toEqual(["2026-07", "2026-08", "2026-09", "2026-10"]);
    expect(t[0]).toMatchObject({ sales: 0, margin: 0, sold: 0, spent: 0 });
  });
});
