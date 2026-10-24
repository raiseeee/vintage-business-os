import { describe, expect, it } from "vitest";
import { IMPORT_MAX_ROWS, parseCsv, parseItemImport } from "./import";

describe("parseCsv", () => {
  it("separatore ; con BOM, CRLF e virgolette", () => {
    const rows = parseCsv('﻿marca;note\r\nNike;"con; punto e virgola"\r\nAdidas;"dice ""ciao"""\r\n');
    expect(rows).toEqual([["marca", "note"], ["Nike", "con; punto e virgola"], ["Adidas", 'dice "ciao"']]);
  });
  it("riconosce la virgola e il tab", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([["a", "b"], ["1", "2"]]);
    expect(parseCsv("a\tb\n1\t2")).toEqual([["a", "b"], ["1", "2"]]);
  });
  it("accetta a capo dentro le virgolette", () => {
    expect(parseCsv('a;b\n"x\ny";z')[1]).toEqual(["x\ny", "z"]);
  });
});

describe("parseItemImport", () => {
  it("mappa le colonne in italiano e inglese, condizione e prezzo con la virgola", () => {
    const r = parseItemImport("Marca;Categoria;Taglia;Condizione;Prezzo previsto (€);Note\nNike;Felpa;M;Buona;25,50;ok\nAdidas;Giacca;L;da riparare;;");
    expect(r.errors).toEqual([]);
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ brand: "Nike", category: "Felpa", size: "M", condition: "buona", expected_price_cents: 2550, notes: "ok" });
    expect(r.items[1]).toMatchObject({ condition: "da_riparare", expected_price_cents: null });
  });
  it("salta le righe vuote e segnala le colonne ignorate (anche il codice)", () => {
    const r = parseItemImport("codice;marca;colore\nX-1;Nike;rosso\n;;\n");
    expect(r.items).toHaveLength(1);
    expect(r.ignoredColumns).toEqual(["codice", "colore"]);
  });
  it("tutto o niente: errori con il numero di riga del file", () => {
    const r = parseItemImport("marca;condizione;prezzo\nNike;boh;10\nAdidas;buona;abc\nPuma;ottima;5");
    expect(r.items).toEqual([]);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatch(/^Riga 2:/);
    expect(r.errors[1]).toMatch(/^Riga 3:/);
  });
  it("file vuoto, senza colonne note, solo intestazione, troppi capi", () => {
    expect(parseItemImport("").errors[0]).toMatch(/vuoto/);
    expect(parseItemImport("foo;bar\n1;2").errors[0]).toMatch(/Nessuna colonna/);
    expect(parseItemImport("marca;taglia\n").errors[0]).toMatch(/solo l'intestazione/);
    const many = "marca\n" + Array.from({ length: IMPORT_MAX_ROWS + 1 }, () => "Nike").join("\n");
    expect(parseItemImport(many).errors[0]).toMatch(/Troppi capi/);
  });
});
