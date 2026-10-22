import { describe, expect, it } from "vitest";
import {
  claimSchema,
  evaluationSchema,
  parseList,
  sourceSchema,
  supplierSchema,
} from "./schemas";

const baseSupplier = {
  name: "Fornitore",
  website: "",
  country: "",
  languages: "",
  stock_types: "",
  brands: "",
  supplier_type: "origine_non_verificata",
  min_order_qty: "",
  min_order_weight_kg: "",
  min_order_value_cents: "",
  price_per_kg_cents: "",
  price_notes: "",
  contact_name: "",
  contact_email: "",
  contact_phone: "",
  notes: "",
};

describe("parseList", () => {
  it("normalizza in minuscolo, toglie spazi e doppioni", () => {
    expect(parseList("Nike, adidas ,NIKE; puma\n")).toEqual(["nike", "adidas", "puma"]);
  });
  it("stringa vuota → lista vuota", () => {
    expect(parseList("  ")).toEqual([]);
  });
});

describe("supplierSchema", () => {
  it("accetta il minimo (solo nome) e trasforma i vuoti in null", () => {
    const r = supplierSchema.parse(baseSupplier);
    expect(r.website).toBeNull();
    expect(r.country).toBeNull();
    expect(r.min_order_qty).toBeNull();
    expect(r.languages).toEqual([]);
  });

  it("rifiuta il nome vuoto", () => {
    expect(supplierSchema.safeParse({ ...baseSupplier, name: "  " }).success).toBe(false);
  });

  it("converte gli euro in centesimi e il paese in maiuscolo", () => {
    const r = supplierSchema.parse({ ...baseSupplier, country: "de", price_per_kg_cents: "6,50", min_order_value_cents: "1.000,00" });
    expect(r.country).toBe("DE");
    expect(r.price_per_kg_cents).toBe(650);
    expect(r.min_order_value_cents).toBe(100000);
  });

  it("aggiunge https:// a un sito scritto senza protocollo", () => {
    const r = supplierSchema.parse({ ...baseSupplier, website: "example.com/negozio" });
    expect(r.website).toBe("https://example.com/negozio");
  });

  it("rifiuta schemi pericolosi come javascript: e data:", () => {
    expect(supplierSchema.safeParse({ ...baseSupplier, website: "javascript:alert(1)" }).success).toBe(false);
    expect(supplierSchema.safeParse({ ...baseSupplier, website: "data:text/html,<b>x</b>" }).success).toBe(false);
  });

  it("rifiuta paese non ISO, email e numeri non validi", () => {
    expect(supplierSchema.safeParse({ ...baseSupplier, country: "Italia" }).success).toBe(false);
    expect(supplierSchema.safeParse({ ...baseSupplier, contact_email: "non-una-mail" }).success).toBe(false);
    expect(supplierSchema.safeParse({ ...baseSupplier, min_order_qty: "-3" }).success).toBe(false);
    expect(supplierSchema.safeParse({ ...baseSupplier, min_order_qty: "1.5" }).success).toBe(false);
  });

  it("rifiuta un tipo di fornitore sconosciuto", () => {
    expect(supplierSchema.safeParse({ ...baseSupplier, supplier_type: "magico" }).success).toBe(false);
  });
});

describe("sourceSchema", () => {
  it("richiede il titolo e accetta data ISO", () => {
    expect(sourceSchema.safeParse({ title: "", url: "", retrieved_at: "", note: "" }).success).toBe(false);
    const r = sourceSchema.parse({ title: "Sito", url: "https://example.com", retrieved_at: "2026-10-22", note: "" });
    expect(r.retrieved_at).toBe("2026-10-22");
  });
  it("rifiuta una data inesistente", () => {
    expect(sourceSchema.safeParse({ title: "x", url: "", retrieved_at: "2026-13-45", note: "" }).success).toBe(false);
  });
});

describe("claimSchema", () => {
  const uuid = "123e4567-e89b-42d3-a456-426614174000";

  it("un'informazione documentata senza fonte è rifiutata", () => {
    const r = claimSchema.safeParse({ field: "provenienza", statement: "x", evidence_level: "documentato", source_id: "" });
    expect(r.success).toBe(false);
  });

  it("documentata con fonte è accettata", () => {
    const r = claimSchema.safeParse({ field: "provenienza", statement: "x", evidence_level: "documentato", source_id: uuid });
    expect(r.success).toBe(true);
  });

  it("dichiarata o ipotesi non richiedono la fonte", () => {
    for (const level of ["dichiarato", "ipotesi"]) {
      const r = claimSchema.parse({ field: "moq", statement: "x", evidence_level: level, source_id: "" });
      expect(r.source_id).toBeNull();
    }
  });
});

describe("evaluationSchema", () => {
  const ok = { proximity: "3", transparency: "4", min_order: "0", budget_fit: "5", vintage_interest: "2", comment: "" };

  it("converte i voti in numeri", () => {
    const r = evaluationSchema.parse(ok);
    expect(r.proximity).toBe(3);
    expect(r.min_order).toBe(0);
  });

  it("rifiuta voti fuori scala o non interi", () => {
    expect(evaluationSchema.safeParse({ ...ok, proximity: "6" }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...ok, proximity: "2.5" }).success).toBe(false);
    expect(evaluationSchema.safeParse({ ...ok, proximity: "" }).success).toBe(false);
  });
});
