import { describe, expect, it } from "vitest";
import {
  allocatedItemCost,
  computeDashboard,
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
