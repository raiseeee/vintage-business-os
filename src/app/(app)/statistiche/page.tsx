import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { Stat, formatDate, toneOf } from "@/components/ui";
import { getBusinessData } from "@/lib/business/queries";
import { computeLotStats } from "@/lib/business/lotStats";
import { investmentsTotal } from "@/lib/inventory/calc";
import { getInventory } from "@/lib/inventory/queries";
import { formatEuro } from "@/lib/metrics";
import { bpToText } from "@/lib/profit";

export const metadata = { title: "Statistiche · ARCHVNT" };

const toneClass = { neutral: "text-stone-700", good: "text-stone-900", bad: "text-stone-900" };

export default async function StatistichePage() {
  const [{ lots, items, sales }, inventory] = await Promise.all([getBusinessData(), getInventory()]);
  const investments = investmentsTotal(inventory.rows);
  const rows = computeLotStats(lots, items, sales).sort((a, b) => b.lot.purchased_at.localeCompare(a.lot.purchased_at));

  const total = rows.reduce(
    (t, r) => ({ cost: t.cost + r.totalCost, net: t.net + r.netRevenue, profit: t.profit + r.profit, sold: t.sold + r.sold, registered: t.registered + r.registered }),
    { cost: 0, net: 0, profit: 0, sold: 0, registered: 0 },
  );
  const afterInvestments = total.profit - investments;

  return (
    <>
      <PageHeader
        title="Statistiche"
        description="Lotto per lotto: quanto hai speso, quanto è rientrato e quanto hai guadagnato. Clicca un lotto per vedere i suoi capi."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Speso nei lotti" value={formatEuro(total.cost)} hint={`${rows.length} lotti`} />
        <Stat label="Incassi netti" value={formatEuro(total.net)} hint="Dopo commissioni e spedizioni" />
        <Stat label="Profitto" value={formatEuro(total.profit)} tone={toneOf(total.profit)} hint="Sui capi venduti: costo del lotto e materiali inclusi" />
        <Stat label="Capi venduti" value={`${total.sold}/${total.registered}`} hint="Su quelli registrati" />
        {investments > 0 && (
          <>
            <Stat label="Investimenti (attrezzature)" value={formatEuro(investments)} hint="Dalla pagina Inventario" />
            <Stat
              label="Risultato dopo gli investimenti"
              value={formatEuro(afterInvestments)}
              tone={toneOf(afterInvestments)}
              hint={afterInvestments >= 0 ? "Hai già recuperato le attrezzature" : "Quanto manca per recuperarle"}
            />
          </>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-stone-900">Non ci sono ancora lotti.</p>
          <p className="mt-2 text-sm text-stone-600">
            Registra un acquisto in <Link href="/lotti" className="underline">Acquisti e lotti</Link>: le statistiche compaiono qui.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[896px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-4 py-4 font-semibold">Lotto</th>
                <th className="px-4 py-4 text-right font-semibold">Venduti</th>
                <th className="px-4 py-4 text-right font-semibold">Costo lotto</th>
                <th className="px-4 py-4 text-right font-semibold">Incassi netti</th>
                <th className="px-4 py-4 text-right font-semibold">Rientrato</th>
                <th className="px-4 py-4 text-right font-semibold">Profitto</th>
                <th className="px-4 py-4 text-right font-semibold">Margine</th>
                <th className="px-4 py-4 text-right font-semibold">Giorni medi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => (
                <tr key={r.lot.id} className="hover:bg-stone-50">
                  <td className="px-4 py-4">
                    <Link href={`/statistiche/${r.lot.id}`} className="font-semibold text-stone-900 underline-offset-2 hover:underline">
                      {r.lot.code}
                    </Link>
                    <p className="text-xs text-stone-500">
                      {r.lot.supplier_name ? `${r.lot.supplier_name} · ` : ""}{formatDate(r.lot.purchased_at)}
                    </p>
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">
                    {r.sold}/{r.registered}
                    {r.registered < r.lot.quantity && <span className="block text-xs text-stone-500">su {r.lot.quantity} dichiarati</span>}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">{formatEuro(r.totalCost)}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{formatEuro(r.netRevenue)}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{bpToText(r.recoveredBp)}</td>
                  <td className={`px-4 py-4 text-right font-semibold tabular-nums ${toneClass[toneOf(r.sold > 0 ? r.profit : 0)]}`}>
                    {r.sold > 0 ? formatEuro(r.profit) : "—"}
                  </td>
                  <td className="px-4 py-4 text-right tabular-nums">{bpToText(r.marginBp)}</td>
                  <td className="px-4 py-4 text-right tabular-nums">{r.avgDays ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-4 max-w-3xl space-y-2 text-xs text-stone-500">
        <p><strong>Rientrato</strong> = incassi netti / costo dell&apos;intero lotto: sopra il 100% il lotto si è ripagato. <strong>Profitto</strong> = incassi netti dei capi venduti − il loro costo (costo del lotto diviso i capi dichiarati). <strong>Margine</strong> = profitto / incassi.</p>
        <p><strong>Giorni medi</strong> = dall&apos;acquisto del lotto alla vendita (include il tempo per preparare e pubblicare).</p>
        <p>Vuoi vedere altro? <Link href="/statistiche/analisi" className="underline">Analisi per marca, categoria e canale</Link>.</p>
      </div>
    </>
  );
}
