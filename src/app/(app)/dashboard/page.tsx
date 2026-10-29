import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { LineChart } from "@/components/LineChart";
import { Section, Stat } from "@/components/ui";
import { todayIso } from "@/lib/dates";
import { toMetricItems, toMetricLot } from "@/lib/business/mappers";
import { getBusinessData } from "@/lib/business/queries";
import { monthKey, monthName, monthShort, monthlyTotals, shiftMonth } from "@/lib/business/monthly";
import { computeDashboard, formatEuro, summarizeByLot } from "@/lib/metrics";

export const metadata = { title: "Dashboard · ARCHVNT" };

export default async function DashboardPage() {
  const data = await getBusinessData();
  const { lots, items, sales } = data;

  // Mese in corso e mese precedente, per i confronti; gli ultimi 12 mesi per il grafico.
  const thisKey = monthKey(todayIso());
  const prevKey = shiftMonth(thisKey, -1);
  const series = monthlyTotals(data, thisKey, 12);
  const [prev, cur] = series.slice(-2);
  const previousLabel = monthName(prevKey);

  const metricLots = lots.map(toMetricLot);
  const metricItems = toMetricItems(items, sales);
  const m = computeDashboard(metricLots, metricItems);

  const byLot = lots
    .map((lot) => ({ lot, metrics: summarizeByLot(metricLots, metricItems).get(lot.id)! }))
    .sort((a, b) => b.metrics.realizedMargin - a.metrics.realizedMargin);

  const empty = lots.length === 0;

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Capitale, stock e margini reali della tua attività."
      />

      {empty && (
        <div className="mb-6 rounded-md border border-stone-200 bg-white px-4 py-4 text-sm text-stone-700">
          Non hai ancora registrato nessun acquisto: i valori sono a zero. Per iniziare{" "}
          <Link href="/lotti?nuovo=1" className="font-semibold text-stone-900 underline">registra un lotto</Link>.
        </div>
      )}

      <h2 className="mb-4 text-lg font-semibold text-stone-900">Questo mese, {monthName(thisKey)}</h2>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Vendite" value={formatEuro(cur.sales)} delta={{ current: cur.sales, previous: prev.sales, previousLabel, format: formatEuro }} />
        <Stat label="Margine realizzato" value={formatEuro(cur.margin)} delta={{ current: cur.margin, previous: prev.margin, previousLabel, format: formatEuro }} />
        <Stat label="Capi venduti" value={String(cur.sold)} delta={{ current: cur.sold, previous: prev.sold, previousLabel, format: String }} />
        <Stat label="Speso in lotti" value={formatEuro(cur.spent)} delta={{ current: cur.spent, previous: prev.spent, previousLabel, format: formatEuro }} />
      </div>

      <div className="mt-8">
        <Section title="Vendite e margine, ultimi 12 mesi">
          <LineChart
            ariaLabel="Vendite e margine realizzato per mese, ultimi 12 mesi"
            labels={series.map((m) => monthShort(m.key))}
            series={[
              { name: "Vendite", values: series.map((m) => m.sales / 100) },
              { name: "Margine realizzato", values: series.map((m) => m.margin / 100), dashed: true },
            ]}
            formatValue={(v) => formatEuro(v * 100).replace(",00", "")}
          />
        </Section>
      </div>

      <h2 className="mb-4 mt-8 text-lg font-semibold text-stone-900">In totale</h2>
      <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
        <Stat label="Capitale investito" value={formatEuro(m.capitalInvested)} hint="Merce, spedizione in entrata e altri costi di tutti i lotti" />
        <Stat label="Valore dello stock" value={formatEuro(m.stockValue)} hint={`${m.stockCount} capi in magazzino, al prezzo previsto`} />
        <Stat label="Vendite" value={formatEuro(m.salesRevenue)} hint={`${m.soldCount} capi venduti`} />
        <Stat label="Costi di vendita" value={formatEuro(m.saleCosts)} hint="Commissioni, spedizione in uscita, extra" />
        <Stat label="Margine realizzato" value={formatEuro(m.realizedMargin)} hint="Vendite meno costi di vendita e costo dei capi venduti" />
        <Stat label="Saldo di cassa" value={formatEuro(m.cashBalance)} hint="Incassi netti meno capitale investito: quanto hai già recuperato" />
      </div>

      <section className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Risultati per lotto</h2>
        {byLot.length === 0 ? (
          <p className="text-sm text-stone-500">Nessun acquisto registrato.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
                <tr>
                  <th className="px-4 py-4 font-semibold">Lotto</th>
                  <th className="px-4 py-4 text-right font-semibold">Investito</th>
                  <th className="px-4 py-4 text-right font-semibold">Venduti</th>
                  <th className="px-4 py-4 text-right font-semibold">Vendite</th>
                  <th className="px-4 py-4 text-right font-semibold">Margine realizzato</th>
                  <th className="px-4 py-4 text-right font-semibold">Saldo cassa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {byLot.map(({ lot, metrics }) => (
                  <tr key={lot.id} className="hover:bg-stone-50">
                    <td className="px-4 py-4">
                      <Link href={`/lotti/${lot.id}`} className="font-semibold text-stone-900 hover:underline">{lot.code}</Link>
                      {lot.supplier_name && <p className="text-xs text-stone-500">{lot.supplier_name}</p>}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{formatEuro(metrics.capitalInvested)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{metrics.soldCount}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{formatEuro(metrics.salesRevenue)}</td>
                    <td className={`px-4 py-4 text-right font-semibold tabular-nums `}>{formatEuro(metrics.realizedMargin)}</td>
                    <td className={`px-4 py-4 text-right tabular-nums `}>{formatEuro(metrics.cashBalance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-stone-900">Esporta i dati</h2>
        <div className="flex flex-wrap gap-2">
          <a href="/backup" download className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
            Backup completo (JSON)
          </a>
          {(["capi", "lotti", "vendite"] as const).map((k) => (
            <a key={k} href={`/esporta/${k}`} download className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50">
              CSV {k}
            </a>
          ))}
        </div>
        <p className="mt-2 text-xs text-stone-500">
          Il backup JSON contiene tutte le tabelle (le foto solo come percorsi): è un archivio, non un ripristino automatico. File per Excel: separatore «;», importi con la virgola. Gli importi della dashboard sono quelli reali dei lotti e delle vendite registrate.
        </p>
      </section>
    </>
  );
}
