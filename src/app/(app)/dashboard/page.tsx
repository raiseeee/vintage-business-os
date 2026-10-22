import { PageHeader } from "@/components/PagePlaceholder";
import { computeDashboard, formatEuro, type Item, type Lot } from "@/lib/metrics";

// Milestone 1: il database non è ancora collegato (arriva in Milestone 2).
// Le liste sono vuote di proposito: la dashboard mostra zeri reali, non dati inventati.
const lots: Lot[] = [];
const items: Item[] = [];

export default function DashboardPage() {
  const m = computeDashboard(lots, items);

  const cards = [
    { label: "Capitale investito", value: formatEuro(m.capitalInvested), hint: "Merce + spedizione in entrata + altri costi dei lotti" },
    { label: "Valore dello stock", value: formatEuro(m.stockValue), hint: `${m.stockCount} capi in magazzino, al prezzo previsto` },
    { label: "Vendite", value: formatEuro(m.salesRevenue), hint: `${m.soldCount} capi venduti` },
    { label: "Costi di vendita", value: formatEuro(m.saleCosts), hint: "Commissioni, spedizione in uscita, extra" },
    { label: "Margine realizzato", value: formatEuro(m.realizedMargin), hint: "Vendite − costi di vendita − costo dei capi venduti" },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Panoramica del capitale, dello stock e dei margini reali."
      />

      <div className="mb-6 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Nessun dato collegato: il database arriva nella Milestone 2. I valori
        sotto sono a zero perché non esiste ancora nessun lotto o capo registrato.
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <section key={c.label} className="rounded-lg border border-stone-200 bg-white p-5">
            <p className="text-sm text-stone-500">{c.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums text-stone-900">{c.value}</p>
            <p className="mt-1 text-xs text-stone-500">{c.hint}</p>
          </section>
        ))}
      </div>
    </>
  );
}
