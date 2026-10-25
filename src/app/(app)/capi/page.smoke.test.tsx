import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BusinessData, ItemRow, LotRow, SaleRow } from "@/lib/business/types";

// Prova di rendering della pagina Capi (senza database): scelta del lotto, lista del lotto, azioni rapide.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push() {}, replace() {}, refresh() {} }),
  usePathname: () => "/capi",
}));
vi.mock("./actions", () => ({
  createItem: async () => ({}), publishItem: async () => ({}), recordSale: async () => ({}),
  createItemsBulk: async () => ({}), importItems: async () => ({}),
}));
vi.mock("./uploadPhotos", () => ({ uploadPhotos: async () => ({ uploaded: 0, problems: [] }) }));
vi.mock("@/lib/team/membership", () => ({ getMembership: async () => ({ businessId: "b1", role: "owner" }) }));

const lot = (id: string, code: string, quantity = 5): LotRow =>
  ({ id, supplier_id: "s1", code, purchased_at: "2026-10-01", purchase_cost_cents: 10000, inbound_shipping_cents: 0, other_costs_cents: 0, quantity, weight_kg: null, notes: null, is_demo: false, created_at: "" });
const item = (id: string, lot_id: string, status: ItemRow["status"], extra: Partial<ItemRow> = {}): ItemRow =>
  ({ id, lot_id, code: id.toUpperCase(), brand: null, category: null, size: null, condition: null, status, expected_price_cents: 4500, notes: null, is_demo: false, created_at: "", ...extra });

const data: BusinessData = {
  suppliers: [{ id: "s1", name: "Fornitore Uno" }],
  lots: [lot("l1", "L1"), lot("l2", "L2")],
  items: [
    item("a-1", "l1", "da_fotografare"),
    item("a-2", "l1", "pronto"),
    item("a-3", "l1", "pubblicato", { listing_channel: "Vinted" }),
    item("b-1", "l2", "da_controllare"),
  ],
  sales: [] as SaleRow[],
};
vi.mock("@/lib/business/queries", () => ({
  getBusinessData: async () => data,
  getFirstPhotoUrls: async () => new Map(),
}));

async function render(searchParams: Record<string, string>) {
  const { default: CapiPage } = await import("./page");
  const element = await CapiPage({ searchParams: Promise.resolve(searchParams) } as never);
  return renderToStaticMarkup(element);
}

beforeEach(() => vi.resetModules());

describe("pagina Capi", () => {
  it("senza lotto mostra prima la scelta del lotto, con il riepilogo degli stati", async () => {
    const html = await render({});
    expect(html).toContain("Scegli un lotto");
    expect(html).toContain('href="/capi?lot=l1"');
    expect(html).toContain("1 da fotografare");
    expect(html).toContain("1 pronto per la vendita");
    expect(html).not.toContain("A-1"); // i capi non sono ancora elencati
  });

  it("scelto il lotto mostra solo i suoi capi e le azioni rapide", async () => {
    const html = await render({ lot: "l1" });
    expect(html).toContain("Capi del lotto L1");
    expect(html).toContain("A-1");
    expect(html).not.toContain("B-1");
    expect(html).toContain("Pubblica"); // capo pronto
    expect(html).toContain("Segna venduto"); // capo pubblicato
    expect(html).toContain("su Vinted");
    expect(html).toContain("Dove l&#x27;hai messo in vendita");
    expect(html).toContain("Prezzo di vendita (€)");
  });

  it("«tutti» elenca i capi di ogni lotto", async () => {
    const html = await render({ lot: "tutti" });
    expect(html).toContain("A-1");
    expect(html).toContain("B-1");
  });

  it("il filtro di stato resta dentro il lotto", async () => {
    const html = await render({ lot: "l1", status: "pronto" });
    expect(html).toContain("A-2");
    expect(html).not.toContain("A-1<");
  });

  it("un lotto inesistente torna alla scelta del lotto", async () => {
    const html = await render({ lot: "xx" });
    expect(html).toContain("Scegli un lotto");
  });
});
