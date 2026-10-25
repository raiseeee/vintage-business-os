import { describe, expect, it } from "vitest";
import {
  allocatedItemCost,
  computeDashboard,
  summarizeByLot,
  summarizeBySupplier,
  itemProfit,
  lotTotalCost,
  saleNetRevenue,
  type Item,
  type Lot,
} from "./metrics";

// Lotto di prova: 10 capi, 100€ merce + 20€ spedizione in entrata + 10€ altri costi = 130€
const lot: Lot = {
  id: "lot-1",
  purchaseCost: 10000,
  inboundShipping: 2000,
  otherCosts: 1000,
  quantity: 10,
};

const soldItem: Item = {
  id: "item-1",
  lotId: "lot-1",
  status: "venduto",
  expectedPrice: 4000,
  sale: { price: 4500, fees: 300, outboundShipping: 500, extraCosts: 100 },
};

describe("costi di lotto", () => {
  it("somma merce, spedizione in entrata e altri costi", () => {
    expect(lotTotalCost(lot)).toBe(13000);
  });

  it("attribuisce a ogni capo il costo totale diviso la quantità dichiarata", () => {
    expect(allocatedItemCost(lot)).toBe(1300);
  });

  it("restituisce 0 se la quantità è zero, senza dividere per zero", () => {
    expect(allocatedItemCost({ ...lot, quantity: 0 })).toBe(0);
  });
});

describe("profitto del capo", () => {
  it("calcola il ricavo netto sottraendo i soli costi di vendita", () => {
    expect(saleNetRevenue(soldItem.sale!)).toBe(3600);
  });

  it("profitto = ricavo netto - costo attribuito del lotto", () => {
    expect(itemProfit(soldItem, lot)).toBe(2300);
  });

  it("è null per un capo non venduto", () => {
    expect(itemProfit({ ...soldItem, status: "pubblicato", sale: null }, lot)).toBeNull();
  });
});

describe("dashboard", () => {
  it("con nessun dato restituisce solo zeri", () => {
    const m = computeDashboard([], []);
    expect(m.capitalInvested).toBe(0);
    expect(m.stockValue).toBe(0);
    expect(m.salesRevenue).toBe(0);
    expect(m.realizedMargin).toBe(0);
  });

  it("non conta due volte la spedizione: quella del lotto e quella della vendita sono separate", () => {
    const m = computeDashboard([lot], [soldItem]);
    expect(m.capitalInvested).toBe(13000); // include 2000 di spedizione in entrata
    expect(m.saleCosts).toBe(900); // include solo i 500 di spedizione in uscita
    expect(m.costOfGoodsSold).toBe(1300);
    // 4500 - 900 - 1300
    expect(m.realizedMargin).toBe(2300);
  });

  it("il margine realizzato coincide con la somma dei profitti dei capi venduti", () => {
    const second: Item = { ...soldItem, id: "item-2", sale: { price: 2000, fees: 100, outboundShipping: 400, extraCosts: 0 } };
    const m = computeDashboard([lot], [soldItem, second]);
    const sum = (itemProfit(soldItem, lot) ?? 0) + (itemProfit(second, lot) ?? 0);
    expect(m.realizedMargin).toBe(sum);
  });

  it("calcola il valore dello stock solo sui capi non venduti e non resi", () => {
    const items: Item[] = [
      soldItem,
      { id: "a", lotId: "lot-1", status: "pronto", expectedPrice: 3000, sale: null },
      { id: "b", lotId: "lot-1", status: "da_controllare", expectedPrice: null, sale: null },
      { id: "c", lotId: "lot-1", status: "reso", expectedPrice: 5000, sale: null },
    ];
    const m = computeDashboard([lot], items);
    expect(m.stockValue).toBe(3000);
    expect(m.stockCount).toBe(2);
    expect(m.soldCount).toBe(1);
  });
});

describe("saldo di cassa e netto", () => {
  it("netRevenue = vendite - costi di vendita; cashBalance = netto - capitale investito", () => {
    const m = computeDashboard([lot], [soldItem]);
    expect(m.netRevenue).toBe(3600);
    expect(m.cashBalance).toBe(3600 - 13000);
  });

  it("con nessun dato sono zero", () => {
    const m = computeDashboard([], []);
    expect(m.netRevenue).toBe(0);
    expect(m.cashBalance).toBe(0);
  });
});

describe("riepiloghi per lotto e per fornitore", () => {
  const lotA: Lot = { ...lot, id: "A", supplierId: "S1" };
  const lotB: Lot = { id: "B", supplierId: "S1", purchaseCost: 5000, inboundShipping: 0, otherCosts: 0, quantity: 5 };
  const lotC: Lot = { id: "C", supplierId: "S2", purchaseCost: 2000, inboundShipping: 0, otherCosts: 0, quantity: 2 };

  const sale = { price: 3000, fees: 0, outboundShipping: 0, extraCosts: 0 };
  const items: Item[] = [
    { id: "1", lotId: "A", status: "venduto", expectedPrice: 3000, sale },
    { id: "2", lotId: "B", status: "venduto", expectedPrice: 3000, sale },
    { id: "3", lotId: "B", status: "pronto", expectedPrice: 1500, sale: null },
    { id: "4", lotId: "C", status: "pubblicato", expectedPrice: 1000, sale: null },
  ];

  it("per lotto: ogni lotto conta solo i propri capi, anche se vuoto", () => {
    const byLot = summarizeByLot([lotA, lotB, lotC], items);
    expect(byLot.get("A")!.salesRevenue).toBe(3000);
    expect(byLot.get("B")!.salesRevenue).toBe(3000);
    expect(byLot.get("B")!.stockValue).toBe(1500);
    expect(byLot.get("C")!.salesRevenue).toBe(0);
    expect(byLot.get("C")!.capitalInvested).toBe(2000);
  });

  it("per fornitore: somma i lotti dello stesso fornitore", () => {
    const bySupplier = summarizeBySupplier([lotA, lotB, lotC], items);
    const s1 = bySupplier.get("S1")!;
    expect(s1.capitalInvested).toBe(13000 + 5000);
    expect(s1.salesRevenue).toBe(6000);
    expect(s1.soldCount).toBe(2);
    expect(bySupplier.get("S2")!.capitalInvested).toBe(2000);
  });

  it("la somma dei fornitori coincide col totale della dashboard (nessun doppio conteggio)", () => {
    const all = [lotA, lotB, lotC];
    const total = computeDashboard(all, items);
    const parts = [...summarizeBySupplier(all, items).values()];
    expect(parts.reduce((s, m) => s + m.capitalInvested, 0)).toBe(total.capitalInvested);
    expect(parts.reduce((s, m) => s + m.salesRevenue, 0)).toBe(total.salesRevenue);
    expect(parts.reduce((s, m) => s + m.realizedMargin, 0)).toBe(total.realizedMargin);
    expect(parts.reduce((s, m) => s + m.stockValue, 0)).toBe(total.stockValue);
  });

  it("la somma dei lotti coincide col totale", () => {
    const all = [lotA, lotB, lotC];
    const total = computeDashboard(all, items);
    const parts = [...summarizeByLot(all, items).values()];
    expect(parts.reduce((s, m) => s + m.realizedMargin, 0)).toBe(total.realizedMargin);
    expect(parts.reduce((s, m) => s + m.cashBalance, 0)).toBe(total.cashBalance);
  });

  it("i lotti senza fornitore non entrano nei riepiloghi per fornitore", () => {
    const orphan: Lot = { ...lotC, id: "X", supplierId: undefined };
    expect(summarizeBySupplier([orphan], []).size).toBe(0);
  });
});

describe("materiali congelati sulla vendita", () => {
  const lot = { id: "l", purchaseCost: 10000, inboundShipping: 0, otherCosts: 0, quantity: 10 };
  const sale = { price: 4000, fees: 300, outboundShipping: 400, extraCosts: 0 };
  it("riducono il ricavo netto e il profitto", () => {
    const item = (materialsCost?: number) => ({ id: "i", lotId: "l", status: "venduto" as const, expectedPrice: null, sale: { ...sale, materialsCost } });
    expect(saleNetRevenue({ ...sale })).toBe(3300);
    expect(saleNetRevenue({ ...sale, materialsCost: 40 })).toBe(3260);
    expect(itemProfit(item(40), lot)).toBe(3260 - 1000);
    expect(itemProfit(item(), lot)).toBe(3300 - 1000);
  });
  it("entrano nei costi di vendita della dashboard", () => {
    const m = computeDashboard([lot], [{ id: "i", lotId: "l", status: "venduto", expectedPrice: null, sale: { ...sale, materialsCost: 40 } }]);
    expect(m.saleCosts).toBe(740);
    expect(m.realizedMargin).toBe(4000 - 740 - 1000);
  });
});
