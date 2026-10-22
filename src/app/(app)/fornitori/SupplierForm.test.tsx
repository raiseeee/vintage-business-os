import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SupplierForm } from "./SupplierForm";
import type { Supplier } from "@/lib/suppliers/types";

const noop = async () => ({ error: null, ok: false });

const supplier: Supplier = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  name: "Esempio Srl",
  website: "https://example.com/",
  country: "DE",
  languages: ["de", "en"],
  stock_types: ["sportswear"],
  brands: ["marca a"],
  supplier_type: "rivenditore",
  min_order_qty: 50,
  min_order_weight_kg: 100,
  min_order_value_cents: 100000,
  price_per_kg_cents: 650,
  price_notes: null,
  contact_name: null,
  contact_email: null,
  contact_phone: null,
  contact_status: "da_contattare",
  next_action: null,
  next_action_date: null,
  last_contacted_at: null,
  notes: null,
  is_demo: false,
  created_at: "2026-10-22T10:00:00Z",
  updated_at: "2026-10-22T10:00:00Z",
};

describe("SupplierForm", () => {
  it("mostra tutti i campi e i cinque tipi di fornitore, con origine non verificata di default", () => {
    const html = renderToStaticMarkup(<SupplierForm action={noop} submitLabel="Crea" />);
    for (const name of ["name", "website", "country", "supplier_type", "languages", "stock_types", "brands", "min_order_qty", "min_order_weight_kg", "min_order_value_cents", "price_per_kg_cents", "contact_email"]) {
      expect(html).toContain(`name="${name}"`);
    }
    expect((html.match(/<option/g) ?? []).length).toBe(5);
    expect(html).toMatch(/<option value="origine_non_verificata" selected/);
    expect(html).toContain("Crea");
  });

  it("precompila i valori di un fornitore esistente, con gli importi in euro", () => {
    const html = renderToStaticMarkup(<SupplierForm action={noop} supplier={supplier} submitLabel="Salva" />);
    expect(html).toContain('value="Esempio Srl"');
    expect(html).toContain('value="6,50"');
    expect(html).toContain('value="1000,00"');
    expect(html).toContain('value="de, en"');
    expect(html).toMatch(/<option value="rivenditore" selected/);
  });
});
