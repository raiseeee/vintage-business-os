import { describe, expect, it } from "vitest";
import { csvCell, formatCents, toCsv } from "./csv";

describe("csvCell", () => {
  it("lascia invariato il testo semplice e vuota i null", () => {
    expect(csvCell("ciao")).toBe("ciao");
    expect(csvCell(null)).toBe("");
    expect(csvCell(42)).toBe("42");
  });

  it("mette tra virgolette e raddoppia le virgolette interne", () => {
    expect(csvCell('dice "ciao"')).toBe('"dice ""ciao"""');
  });

  it("racchiude testo con separatore o a capo", () => {
    expect(csvCell("a;b")).toBe('"a;b"');
    expect(csvCell("riga1\nriga2")).toBe('"riga1\nriga2"');
  });

  it("neutralizza le formule di Excel", () => {
    expect(csvCell("=1+1")).toBe("'=1+1");
    expect(csvCell("+39 333")).toBe("'+39 333");
    expect(csvCell("-5")).toBe("'-5");
    expect(csvCell("@SOMMA(A1)")).toBe("'@SOMMA(A1)");
    expect(csvCell('=HYPERLINK("http://x")')).toBe(`"'=HYPERLINK(""http://x"")"`);
  });

  it("formatta gli importi in centesimi con la virgola, anche negativi, senza apostrofo", () => {
    expect(csvCell({ cents: 1250 })).toBe("12,50");
    expect(csvCell({ cents: -150 })).toBe("-1,50");
    expect(csvCell({ cents: 0 })).toBe("0,00");
    expect(csvCell({ cents: 5 })).toBe("0,05");
  });
});

describe("formatCents", () => {
  it("gestisce i casi limite", () => {
    expect(formatCents(100000)).toBe("1000,00");
    expect(formatCents(-5)).toBe("-0,05");
  });
});

describe("toCsv", () => {
  it("inizia con il BOM, usa ; e finisce con a capo", () => {
    const csv = toCsv(["a", "b"], [["x", { cents: 100 }], ["y;z", null]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv.slice(1)).toBe('a;b\r\nx;1,00\r\n"y;z";\r\n');
  });
});
