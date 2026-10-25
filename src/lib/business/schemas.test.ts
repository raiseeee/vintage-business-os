import { describe, expect, it } from "vitest";
import {
  bulkItemsSchema,
  itemCreateSchema,
  lotSchema,
  photoPathSchema,
  saleSchema,
} from "./schemas";

const uuid = "123e4567-e89b-42d3-a456-426614174000";
const uuid2 = "223e4567-e89b-42d3-a456-426614174000";

const lot = {
  supplier_name: "Mercato di Prato",
  code: "L-001",
  purchased_at: "2026-10-22",
  purchase_cost_cents: "150,00",
  inbound_shipping_cents: "25",
  other_costs_cents: "",
  quantity: "10",
  weight_kg: "8,5",
  notes: "",
};

describe("lotSchema", () => {
  it("converte euro in centesimi e tratta i costi vuoti come zero", () => {
    const r = lotSchema.parse(lot);
    expect(r.purchase_cost_cents).toBe(15000);
    expect(r.inbound_shipping_cents).toBe(2500);
    expect(r.other_costs_cents).toBe(0);
    expect(r.quantity).toBe(10);
    expect(r.weight_kg).toBe(8.5);
  });

  it("il costo di acquisto è obbligatorio, ma zero è ammesso", () => {
    expect(lotSchema.safeParse({ ...lot, purchase_cost_cents: "" }).success).toBe(false);
    expect(lotSchema.parse({ ...lot, purchase_cost_cents: "0" }).purchase_cost_cents).toBe(0);
  });

  it("rifiuta quantità zero o negativa, date impossibili e codici strani", () => {
    expect(lotSchema.safeParse({ ...lot, quantity: "0" }).success).toBe(false);
    expect(lotSchema.safeParse({ ...lot, quantity: "-2" }).success).toBe(false);
    expect(lotSchema.safeParse({ ...lot, purchased_at: "2026-02-31" }).success).toBe(false);
    expect(lotSchema.safeParse({ ...lot, code: "=cmd|x" }).success).toBe(false);
    expect(lotSchema.safeParse({ ...lot, code: "" }).success).toBe(false);
    expect(lotSchema.safeParse({ ...lot, supplier_name: "x".repeat(121) }).success).toBe(false);
  });
});

describe("itemCreateSchema", () => {
  const item = { lot_id: uuid, code: "L-001-001", brand: "", category: "Felpa", size: "L", condition: "buona", status: "da_controllare", expected_price_cents: "45", notes: "" };

  it("accetta un capo valido e converte il prezzo", () => {
    const r = itemCreateSchema.parse(item);
    expect(r.expected_price_cents).toBe(4500);
    expect(r.brand).toBeNull();
  });

  it("la condizione è facoltativa", () => {
    expect(itemCreateSchema.parse({ ...item, condition: "" }).condition).toBeNull();
    expect(itemCreateSchema.safeParse({ ...item, condition: "perfetta" }).success).toBe(false);
  });

  it("lo stato «venduto» non si imposta a mano", () => {
    expect(itemCreateSchema.safeParse({ ...item, status: "venduto" }).success).toBe(false);
    expect(itemCreateSchema.parse({ ...item, status: "reso" }).status).toBe("reso");
  });
});

describe("bulkItemsSchema", () => {
  it("accetta da 1 a 200 capi", () => {
    expect(bulkItemsSchema.parse({ lot_id: uuid, count: "50" }).count).toBe(50);
    expect(bulkItemsSchema.safeParse({ lot_id: uuid, count: "0" }).success).toBe(false);
    expect(bulkItemsSchema.safeParse({ lot_id: uuid, count: "201" }).success).toBe(false);
  });
});

describe("saleSchema", () => {
  const sale = { channel: "Vinted", sold_at: "2026-10-22", price_cents: "45,00", fees_cents: "3", outbound_shipping_cents: "5", extra_costs_cents: "", notes: "" };

  it("converte tutti gli importi in centesimi", () => {
    const r = saleSchema.parse(sale);
    expect(r.price_cents).toBe(4500);
    expect(r.fees_cents).toBe(300);
    expect(r.outbound_shipping_cents).toBe(500);
    expect(r.extra_costs_cents).toBe(0);
  });

  it("richiede canale e prezzo, rifiuta importi negativi o non numerici", () => {
    expect(saleSchema.safeParse({ ...sale, channel: " " }).success).toBe(false);
    expect(saleSchema.safeParse({ ...sale, price_cents: "" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...sale, fees_cents: "-1" }).success).toBe(false);
    expect(saleSchema.safeParse({ ...sale, extra_costs_cents: "tanto" }).success).toBe(false);
  });
});

describe("saleSchema con la finestra «Segna venduto»", () => {
  it("accetta il form rapido, che non invia costi né note", () => {
    const r = saleSchema.safeParse({ channel: "Vinted", sold_at: "2026-10-25", price_cents: "45" });
    expect(r.success && r.data).toMatchObject({ price_cents: 4500, fees_cents: 0, outbound_shipping_cents: 0, extra_costs_cents: 0, notes: null });
  });
  it("richiede comunque il prezzo e il canale", () => {
    expect(saleSchema.safeParse({ channel: "Vinted", sold_at: "2026-10-25" }).success).toBe(false);
    expect(saleSchema.safeParse({ sold_at: "2026-10-25", price_cents: "45" }).success).toBe(false);
  });
});

describe("photoPathSchema", () => {
  const schema = photoPathSchema(uuid, uuid2);

  it("accetta solo percorsi nella cartella dell'utente e del capo", () => {
    expect(schema.safeParse(`${uuid}/${uuid2}/abcd1234-ef56.jpg`).success).toBe(true);
  });

  it("rifiuta altre cartelle, traversal ed estensioni non ammesse", () => {
    expect(schema.safeParse(`${uuid2}/${uuid2}/abcd1234.jpg`).success).toBe(false);
    expect(schema.safeParse(`${uuid}/${uuid}/abcd1234.jpg`).success).toBe(false);
    expect(schema.safeParse(`${uuid}/${uuid2}/../abcd1234.jpg`).success).toBe(false);
    expect(schema.safeParse(`${uuid}/${uuid2}/abcd1234.svg`).success).toBe(false);
    expect(schema.safeParse(`${uuid}/${uuid2}/abcd1234.jpg/extra`).success).toBe(false);
  });
});
