import { describe, expect, it } from "vitest";
import { centsToInput, parseEuroToCents } from "./money";

describe("parseEuroToCents", () => {
  it.each([
    ["12", 1200],
    ["12,5", 1250],
    ["12,50", 1250],
    ["12.50", 1250],
    ["0,99", 99],
    ["0", 0],
    ["€ 12,50", 1250],
    ["1.234,56", 123456],
    ["1234,56", 123456],
  ])("accetta %s", (input, expected) => {
    expect(parseEuroToCents(input)).toBe(expected);
  });

  it.each([
    [""],
    ["abc"],
    ["-5"],
    ["12,345"],
    ["1.234"], // ambiguo
    ["1,234,56"],
    ["1,234.56"], // separatori nell'ordine inglese
    ["12,5,0"],
  ])("rifiuta %s", (input) => {
    expect(parseEuroToCents(input)).toBeUndefined();
  });

  it("non perde precisione sui decimali (0,29 = 29 centesimi)", () => {
    expect(parseEuroToCents("0,29")).toBe(29);
    expect(parseEuroToCents("19,99")).toBe(1999);
  });
});

describe("centsToInput", () => {
  it("formatta i centesimi con la virgola", () => {
    expect(centsToInput(1250)).toBe("12,50");
    expect(centsToInput(5)).toBe("0,05");
    expect(centsToInput(100000)).toBe("1000,00");
  });
  it("null e undefined diventano stringa vuota", () => {
    expect(centsToInput(null)).toBe("");
    expect(centsToInput(undefined)).toBe("");
  });
  it("è l'inverso di parseEuroToCents", () => {
    for (const c of [0, 1, 99, 650, 123456]) {
      expect(parseEuroToCents(centsToInput(c))).toBe(c);
    }
  });
});
