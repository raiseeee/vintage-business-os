import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { Stat, toneOf } from "@/components/ui";
import { toMetricItems, toMetricLot } from "@/lib/business/mappers";
import { getBusinessData } from "@/lib/business/queries";
import { computeDashboard, formatEuro, summarizeBySupplier } from "@/lib/metrics";

export const metadata = { title: "Dashboard · Vintage Business OS" };

const toneClass = { neutral: "text-stone-700", good: "text-green-800", bad: "text-red-800" };

export default async function DashboardPage() {
  const { suppliers, lots, items, sales } = await getBusinessData();

  const metricLots = lots.map(toMetricLot);
  const metricItems = toMetricItems(items, sales);
  const m = computeDashboard(metricLots, metricItems);

  const supplierName = new Map(suppliers.map((s) => [s.id, s.name]));
  const bySupplier = [...summarizeBySupplier(metricLots, metricItems).entries()]
    .map(([id, metrics]) => ({ id, name: supplierName.get(id) ?? "—", metrics }))
    .sort((a, b) => b.metrics.realizedMargin - a.metrics.realizedMargin);

  const empty = lots.length === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Capitale, stock e margini reali della tua attività."
      />

      {empty && (
        <div className="mb-6 rounded-md border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
          Non hai ancora registrato nessun acquisto: i valori sono a zero. Per iniziare,{" "}
          <Link href="/fornitori" className="font-medium text-stone-900 underline">aggiungi un fornitore</Link>, poi{" "}
          <Link href="/lotti/nuovo" className="font-medium text-stone-900 underline">registra un lotto</Link>.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Capitale investito" value={formatEuro(m.capitalInvested)} hint="Merce + spedizione in entrata + altri costi di tutti i lotti" />
        <Stat label="Valore dello stock" value={formatEuro(m.stockValue)} hint={`${m.stockCount} capi in magazzino, al prezzo previsto`} />
        <Stat label="Vendite" value={formatEuro(m.salesRevenue)} hint={`${m.soldCount} capi venduti`} />
        <Stat label="Costi di vendita" value={formatEuro(m.saleCosts)} hint="Commissioni, spedizione in uscita, extra" />
        <Stat label="Margine realizzato" value={formatEuro(m.realizedMargin)} tone={toneOf(m.realizedMargin)} hint="Vendite − costi di vendita − costo dei capi venduti" />
        <Stat label="Saldo di cassa" value={formatEuro(m.cashBalance)} tone={toneOf(m.cashBalance)} hint="Incassi netti − capitale investito: quanto hai già recuperato" />
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Risultati per fornitore</h2>
        {bySupplier.length === 0 ? (
          <p className="text-sm text-stone-500">Nessun acquisto registrato.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="px-4 py-3 font-medium">Fornitore</th>
                  <th className="px-4 py-3 text-right font-medium">Investito</th>
                  <th className="px-4 py-3 text-right font-medium">Venduti</th>
                  <th className="px-4 py-3 text-right font-medium">Vendite</th>
                  <th className="px-4 py-3 text-right font-medium">Margine realizzato</th>
                  <th className="px-4 py-3 text-right font-medium">Saldo cassa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {bySupplier.map(({ id, name, metrics }) => (
                  <tr key={id} className="hover:bg-stone-50">
                    <td className="px-4 py-3">
                      <Link href={`/fornitori/${id}`} className="font-medium text-stone-900 hover:underline">{name}</Link>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEuro(metrics.capitalInvested)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{metrics.soldCount}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatEuro(metrics.salesRevenue)}</td>
                    <td className={`px-4 py-3 text-right font-medium tabular-nums ${toneClass[toneOf(metrics.realizedMargin)]}`}>{formatEuro(metrics.realizedMargin)}</td>
                    <td className={`px-4 py-3 text-right tabular-nums ${toneClass[toneOf(metrics.cashBalance)]}`}>{formatEuro(metrics.cashBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Esporta i dati</h2>
        <div className="flex flex-wrap gap-2">
          {(["capi", "lotti", "vendite"] as const).map((k) => (
            <a key={k} href={`/esporta/${k}`} download className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
              CSV {k}
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          File per Excel: separatore «;», importi con la virgola. Gli importi della dashboard sono quelli reali dei lotti e delle vendite registrate (i dati demo sono inclusi finché non li rimuovi).
        </p>
      </section>
    </>
  );
}
