import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PagePlaceholder";
import { ItemStatusBadge, Stat, formatDate, toneOf } from "@/components/ui";
import { computeItemStats, computeLotStats } from "@/lib/business/lotStats";
import { getBusinessData } from "@/lib/business/queries";
import { toMetricSale } from "@/lib/business/mappers";
import { formatEuro, saleNetRevenue } from "@/lib/metrics";
import { bpToText } from "@/lib/profit";
import { uuidSchema } from "@/lib/validation";

export const metadata = { title: "Statistiche lotto · Vintage Business OS" };

const toneClass = { neutral: "text-stone-700", good: "text-green-800", bad: "text-red-800" };

export default async function StatisticheLottoPage(props: PageProps<"/statistiche/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const { lots, items, sales } = await getBusinessData();
  const lot = lots.find((l) => l.id === id);
  if (!lot) notFound();

  const [row] = computeLotStats([lot], items.filter((i) => i.lot_id === id), sales);
  const itemRows = computeItemStats(lot, items, sales);

  return (
    <>
      <PageHeader
        title={`Statistiche del lotto ${lot.code}`}
        back={{ href: "/statistiche", label: "Tutti i lotti" }}
        description={`${lot.supplier_name ? `${lot.supplier_name} · ` : ""}acquistato il ${formatDate(lot.purchased_at)}`}
        actions={
          <Link href={`/lotti/${lot.id}`} className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
            Scheda del lotto
          </Link>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Costo del lotto" value={formatEuro(row.totalCost)} hint={`${lot.quantity} capi dichiarati`} />
        <Stat label="Incassi netti" value={formatEuro(row.netRevenue)} hint={`${formatEuro(row.revenue)} lordi`} />
        <Stat label="Rientrato" value={bpToText(row.recoveredBp)} tone={row.cashBalance >= 0 ? "good" : "neutral"} hint={`Saldo ${formatEuro(row.cashBalance)}`} />
        <Stat label="Profitto" value={row.sold > 0 ? formatEuro(row.profit) : "—"} tone={toneOf(row.sold > 0 ? row.profit : 0)} hint={`Margine ${bpToText(row.marginBp)}`} />
        <Stat label="Venduti" value={`${row.sold}/${row.registered}`} hint={row.returned > 0 ? `${row.returned} resi` : "Capi registrati"} />
        <Stat label="In magazzino" value={String(row.inStock)} />
        <Stat label="Giorni medi alla vendita" value={row.avgDays !== null ? String(row.avgDays) : "—"} />
        <Stat label="Costo per capo" value={formatEuro(itemRows[0]?.cost ?? (lot.quantity > 0 ? Math.round(row.totalCost / lot.quantity) : 0))} />
      </div>

      <h2 className="mb-3 mt-8 text-base font-semibold text-stone-900">Capi del lotto</h2>
      {itemRows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-600">Questo lotto non ha ancora capi registrati.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Capo</th>
                <th className="px-4 py-3 font-medium">Stato</th>
                <th className="px-4 py-3 text-right font-medium">Costo</th>
                <th className="px-4 py-3 text-right font-medium">Venduto a</th>
                <th className="px-4 py-3 text-right font-medium">Netto</th>
                <th className="px-4 py-3 text-right font-medium">Profitto</th>
                <th className="px-4 py-3 font-medium">Canale</th>
                <th className="px-4 py-3 text-right font-medium">Giorni</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {itemRows.map(({ item, sale, cost, profit, days }) => (
                <tr key={item.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/capi/${item.id}`} className="font-medium text-stone-900 underline-offset-2 hover:underline">{item.code}</Link>
                    <p className="text-xs text-stone-500">{[item.brand, item.category, item.size].filter(Boolean).join(" · ") || "—"}</p>
                  </td>
                  <td className="px-4 py-3"><ItemStatusBadge status={item.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatEuro(cost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {sale ? formatEuro(sale.price_cents) : item.expected_price_cents !== null ? <span className="text-stone-500">{formatEuro(item.expected_price_cents)} prev.</span> : "—"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {sale ? formatEuro(saleNetRevenue(toMetricSale(sale))) : "—"}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium tabular-nums ${profit === null ? "text-stone-400" : toneClass[toneOf(profit)]}`}>
                    {profit === null ? "—" : formatEuro(profit)}
                  </td>
                  <td className="px-4 py-3 text-stone-700">{sale?.channel ?? "—"}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{days ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 max-w-3xl text-xs text-stone-500">
        Il costo di ogni capo è il costo del lotto diviso i capi dichiarati; il profitto di un capo venduto è netto − costo. I capi resi o non ancora venduti non hanno profitto.
      </p>
    </>
  );
}
