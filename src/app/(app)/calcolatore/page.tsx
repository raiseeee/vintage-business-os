import { PageHeader } from "@/components/PagePlaceholder";
import { getBusinessData } from "@/lib/business/queries";
import { materialsCostPerItem } from "@/lib/inventory/calc";
import { getInventory } from "@/lib/inventory/queries";
import { allocatedItemCost } from "@/lib/metrics";
import { toMetricLot } from "@/lib/business/mappers";
import { Calculator, type LotOption } from "./Calculator";

export const metadata = { title: "Calcolatore · Vintage Business OS" };

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function CalcolatorePage(props: PageProps<"/calcolatore">) {
  const params = await props.searchParams;
  // Valori iniziali dal link «Calcola» di un capo (acquisto e prezzo previsto): solo testo, si possono cambiare.
  const initial = {
    purchase: pick(params.acquisto).slice(0, 12),
    salePrice: pick(params.vendita).slice(0, 12),
  };

  const [{ suppliers, lots, items }, inventory] = await Promise.all([getBusinessData(), getInventory()]);
  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const lotOptions: LotOption[] = [...lots]
    .sort((a, b) => b.purchased_at.localeCompare(a.purchased_at))
    .map((lot) => {
      const prices = items.filter((i) => i.lot_id === lot.id && i.expected_price_cents !== null).map((i) => i.expected_price_cents as number);
      return {
        id: lot.id,
        label: `${lot.code} · ${supplierName.get(lot.supplier_id) ?? "fornitore sconosciuto"}`,
        costPerItem: allocatedItemCost(toMetricLot(lot)),
        avgExpectedPrice: prices.length > 0 ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : null,
      };
    });
  const lotParam = pick(params.lotto);

  return (
    <>
      <PageHeader
        title="Calcolatore di redditività"
        description="Scegli un lotto: costo per capo e materiali si compilano da soli. Poi inserisci il prezzo e vedi quanto guadagni e il prezzo minimo per non perdere."
      />
      <Calculator
        initial={initial}
        lots={lotOptions}
        materialsPerItem={materialsCostPerItem(inventory.rows)}
        initialLotId={lotOptions.some((l) => l.id === lotParam) ? lotParam : ""}
      />
    </>
  );
}
