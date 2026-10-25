import { describe, expect, it } from "vitest";
import { bpToText, computeProfit, parsePercentToBp, type ProfitInput } from "./profit";

const base: ProfitInput = {
  purchase: 500, inboundShipping: 100, prep: 50, packaging: 50, otherCosts: 0,
  salePrice: 2000, discountBp: 0, feeBp: 0, feeFixed: 0, outboundShipping: 0,
};

describe("computeProfit", () => {
  it("senza commissioni né sconto: 20 € di prezzo, 7 € di costi → 13 € di profitto", () => {
    const r = computeProfit(base);
    expect(r.totalCosts).toBe(700);
    expect(r.netRevenue).toBe(2000);
    expect(r.profit).toBe(1300);
    expect(r.marginBp).toBe(6500); // 13/20
    expect(r.roiBp).toBe(18571); // 13/7
    expect(r.breakEvenPrice).toBe(700);
  });

  it("con sconto 10%, commissione 5% + 0,70 € fissi e spedizione 4 €", () => {
    const i = { ...base, discountBp: 1000, feeBp: 500, feeFixed: 70, outboundShipping: 400 };
    const r = computeProfit(i);
    expect(r.soldPrice).toBe(1800); // 20 − 10%
    expect(r.fees).toBe(160); // 5% di 18 = 0,90 + 0,70
    expect(r.netRevenue).toBe(1240); // 18 − 1,60 − 4
    expect(r.profit).toBe(540); // 12,40 − 7
  });

  it("il prezzo minimo porta il profitto a zero o appena sopra, e un centesimo in meno va in perdita", () => {
    const i = { ...base, discountBp: 1000, feeBp: 500, feeFixed: 70, outboundShipping: 400 };
    const be = computeProfit(i).breakEvenPrice!;
    expect(computeProfit({ ...i, salePrice: be }).profit).toBeGreaterThanOrEqual(0);
    expect(computeProfit({ ...i, salePrice: be }).profit).toBeLessThan(5);
    expect(computeProfit({ ...i, salePrice: be - 1 }).profit).toBeLessThan(0);
  });

  it("sconto e commissione al 100%: nessun prezzo minimo", () => {
    expect(computeProfit({ ...base, discountBp: 10000 }).breakEvenPrice).toBeNull();
  });

  it("prezzo 0 o costi 0: margine e ROI non definiti", () => {
    const r = computeProfit({ ...base, salePrice: 0, purchase: 0, inboundShipping: 0, prep: 0, packaging: 0 });
    expect(r.marginBp).toBeNull();
    expect(r.roiBp).toBeNull();
  });

  it("vendita in perdita: profitto negativo", () => {
    expect(computeProfit({ ...base, salePrice: 500 }).profit).toBe(-200);
  });
});

describe("percentuali", () => {
  it("legge virgola e punto, rifiuta valori fuori scala", () => {
    expect(parsePercentToBp("12,5")).toBe(1250);
    expect(parsePercentToBp("5%")).toBe(500);
    expect(parsePercentToBp("")).toBe(0);
    expect(parsePercentToBp("101")).toBeUndefined();
    expect(parsePercentToBp("abc")).toBeUndefined();
    expect(parsePercentToBp("1,234")).toBeUndefined();
  });
  it("formatta", () => {
    expect(bpToText(6500)).toBe("65,0%");
    expect(bpToText(null)).toBe("—");
  });
});
