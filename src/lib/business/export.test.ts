import { describe, expect, it } from "vitest";
import { buildCsv, buildItemsCsv, buildLotsCsv, buildSalesCsv } from "./export";
import type { BusinessData } from "./types";

const data: BusinessData = {
  suppliers: [{ id: "s1", name: "Fornitore; Uno" }],
  lots: [
    {
      id: "l1", supplier_id: "s1", code: "L-001", purchased_at: "2026-10-01",
      purchase_cost_cents: 10000, inbound_shipping_cents: 2000, other_costs_cents: 1000,
      quantity: 10, weight_kg: 8.5, notes: "=SOMMA(1;2)", is_demo: false, created_at: "2026-10-01T10:00:00Z",
    },
  ],
  items: [
    { id: "i1", lot_id: "l1", code: "L-001-001", brand: "Marca", category: "Felpa", size: "L", condition: "buona", status: "venduto", expected_price_cents: 4000, notes: null, is_demo: false, created_at: "" },
    { id: "i2", lot_id: "l1", code: "L-001-002", brand: null, category: null, size: null, condition: null, status: "pronto", expected_price_cents: 3000, notes: null, is_demo: true, created_at: "" },
    { id: "i3", lot_id: "l1", code: "L-001-003", brand: null, category: null, size: null, condition: null, status: "reso", expected_price_cents: 2000, notes: null, is_demo: false, created_at: "" },
  ],
  sales: [
    { id: "x1", item_id: "i1", channel: "Vinted", sold_at: "2026-10-10", price_cents: 4500, fees_cents: 300, outbound_shipping_cents: 500, extra_costs_cents: 100, notes: null },
    { id: "x2", item_id: "i3", channel: "Depop", sold_at: "2026-10-12", price_cents: 2500, fees_cents: 0, outbound_shipping_cents: 0, extra_costs_cents: 0, notes: null },
  ],
};

const lines = (csv: string) => csv.replace(/^﻿/, "").trimEnd().split("\r\n");

/** Divide una riga CSV in celle rispettando le virgolette (un ";" tra virgolette non separa). */
function cells(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ";") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

describe("esportazione lotti", () => {
  it("riporta costi, costo per capo, margine e saldo di cassa", () => {
    const [header, row] = lines(buildLotsCsv(data));
    expect(cells(header)).toHaveLength(18);
    const c = cells(row);
    expect(c[0]).toBe("L-001");
    expect(c[5]).toBe("100,00"); // merce
    expect(c[8]).toBe("130,00"); // costo totale
    expect(c[9]).toBe("13,00"); // per capo
    expect(c[11]).toBe("1"); // venduti (il reso non conta)
    expect(c[12]).toBe("45,00"); // incassi
    expect(c[13]).toBe("9,00"); // costi di vendita
    expect(c[14]).toBe("23,00"); // 45 - 9 - 13
    expect(c[15]).toBe("-94,00"); // 36 - 130
  });

  it("protegge i testi che sembrano formule", () => {
    const [, row] = lines(buildLotsCsv(data));
    expect(row).toContain("'=SOMMA(1;2)");
  });
});

describe("esportazione capi", () => {
  it("un capo per riga, con profitto solo per i venduti", () => {
    const rows = lines(buildItemsCsv(data));
    expect(rows).toHaveLength(4); // intestazione + 3 capi
    const sold = cells(rows[1]);
    expect(sold[0]).toBe("L-001-001");
    expect(sold[7]).toBe("Venduto");
    expect(sold[16]).toBe("36,00"); // ricavo netto
    expect(sold[17]).toBe("23,00"); // profitto
    const stock = cells(rows[2]);
    expect(stock[17]).toBe(""); // nessun profitto
    expect(stock[18]).toBe("sì"); // demo
  });

  it("un capo reso non ha profitto anche se ha una vendita precedente", () => {
    const returned = cells(lines(buildItemsCsv(data))[3]);
    expect(returned[7]).toBe("Reso");
    expect(returned[16]).toBe("25,00"); // ricavo netto della vecchia vendita
    expect(returned[17]).toBe(""); // ma nessun profitto
  });

  it("racchiude tra virgolette il nome del fornitore che contiene il separatore", () => {
    expect(lines(buildItemsCsv(data))[1]).toContain('"Fornitore; Uno"');
  });
});

describe("esportazione vendite", () => {
  it("una riga per vendita, ordinata per data, con profitto vuoto per i resi", () => {
    const rows = lines(buildSalesCsv(data));
    expect(rows).toHaveLength(3);
    expect(cells(rows[1])[0]).toBe("2026-10-10");
    expect(cells(rows[1])[12]).toBe("23,00");
    expect(cells(rows[2])[4]).toBe("Reso");
    expect(cells(rows[2])[12]).toBe("");
  });
});

describe("buildCsv", () => {
  it("sceglie il file giusto e inizia sempre con il BOM", () => {
    for (const kind of ["capi", "lotti", "vendite"] as const) {
      expect(buildCsv(kind, data).charCodeAt(0)).toBe(0xfeff);
    }
    expect(buildCsv("lotti", data)).toBe(buildLotsCsv(data));
  });

  it("con nessun dato produce solo l'intestazione", () => {
    const empty: BusinessData = { suppliers: [], lots: [], items: [], sales: [] };
    for (const kind of ["capi", "lotti", "vendite"] as const) {
      expect(lines(buildCsv(kind, empty))).toHaveLength(1);
    }
  });
});
