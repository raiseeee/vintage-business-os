import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { getBusinessData } from "@/lib/business/queries";
import { GROUP_KEYS, GROUP_LABELS, SMALL_SAMPLE, computeGroupStats, type GroupKey } from "@/lib/business/stats";
import { formatEuro } from "@/lib/metrics";
import { bpToText } from "@/lib/profit";
import { toneOf } from "@/components/ui";

export const metadata = { title: "Statistiche · Vintage Business OS" };

const toneClass = { neutral: "text-stone-700", good: "text-green-800", bad: "text-red-800" };

export default async function StatistichePage(props: PageProps<"/statistiche/analisi">) {
  const sp = await props.searchParams;
  const raw = Array.isArray(sp.per) ? sp.per[0] : sp.per;
  const key: GroupKey = (GROUP_KEYS as readonly string[]).includes(raw ?? "") ? (raw as GroupKey) : "marca";

  const { lots, items, sales } = await getBusinessData();
  const rows = computeGroupStats(key, lots, items, sales);
  const hasDemo = items.some((i) => i.is_demo) || lots.some((l) => l.is_demo);

  return (
    <>
      <PageHeader
        title="Analisi per marca, categoria e canale"
        description="Cosa ti rende di più, calcolato solo dalle tue vendite registrate. Nessuna stima di mercato."
      />

      <Link href="/statistiche" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">← Statistiche per lotto</Link>

      <div className="mb-4 flex flex-wrap gap-2">
        {GROUP_KEYS.map((k) => (
          <Link
            key={k}
            href={`/statistiche/analisi?per=${k}`}
            className={`rounded-full px-3 py-1 text-sm ${k === key ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"}`}
          >
            Per {GROUP_LABELS[k].toLowerCase()}
          </Link>
        ))}
      </div>

      {hasDemo && (
        <p className="mb-4 rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-900">
          Nei dati ci sono anche esempi DEMO: finché non li rimuovi (pagina Supplier, in fondo) rientrano nei numeri.
        </p>
      )}

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-stone-900">Non ci sono ancora vendite da analizzare.</p>
          <p className="mt-1 text-sm text-stone-600">Quando registri le vendite dei capi, qui compaiono margini e tempi per {GROUP_LABELS[key].toLowerCase()}.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">{GROUP_LABELS[key]}</th>
                <th className="px-4 py-3 text-right font-medium">Venduti</th>
                {key !== "canale" && <th className="px-4 py-3 text-right font-medium">Venduti su registrati</th>}
                <th className="px-4 py-3 text-right font-medium">Incassi</th>
                <th className="px-4 py-3 text-right font-medium">Profitto</th>
                <th className="px-4 py-3 text-right font-medium">Profitto medio</th>
                <th className="px-4 py-3 text-right font-medium">Margine</th>
                <th className="px-4 py-3 text-right font-medium">Giorni medi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.label} className="hover:bg-stone-50">
                  <td className="px-4 py-3 font-medium text-stone-900">
                    {r.label}
                    {r.smallSample && <span className="ml-2 rounded-full bg-stone-100 px-2 py-0.5 text-xs font-normal text-stone-600">pochi dati</span>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.sold}</td>
                  {key !== "canale" && (
                    <td className="px-4 py-3 text-right tabular-nums text-stone-700">
                      {r.registered !== null ? `${r.sold}/${r.registered}` : "—"} <span className="text-xs text-stone-500">({bpToText(r.sellThroughBp)})</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-right tabular-nums">{formatEuro(r.revenue)}</td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${toneClass[toneOf(r.profit)]}`}>{formatEuro(r.profit)}</td>
                  <td className={`px-4 py-3 text-right tabular-nums ${toneClass[toneOf(r.avgProfit)]}`}>{formatEuro(r.avgProfit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{bpToText(r.marginBp)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.avgDays !== null ? r.avgDays : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-3 max-w-3xl space-y-1 text-xs text-stone-500">
        <p><strong>Profitto</strong> = incassi − commissioni e spedizione − costo attribuito del capo (costo del lotto diviso i capi dichiarati). <strong>Margine</strong> = profitto / incassi.</p>
        <p><strong>Giorni medi</strong> = dall&apos;acquisto del lotto alla vendita: non esiste una data di pubblicazione, quindi include il tempo per preparare e mettere online il capo.</p>
        <p><strong>Venduti su registrati</strong> = capi venduti sui capi registrati di quel gruppo (resi esclusi). «Pochi dati» compare sotto {SMALL_SAMPLE} vendite: sono indizi, non tendenze.</p>
      </div>
    </>
  );
}
