import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/form";
import { ItemStatusBadge, Section, Stat, formatDate, toneOf } from "@/components/ui";
import { toMetricItems, toMetricLot } from "@/lib/business/mappers";
import { getBusinessData } from "@/lib/business/queries";
import { allocatedItemCost, computeDashboard, formatEuro, itemProfit } from "@/lib/metrics";
import { uuidSchema } from "@/lib/validation";
import { createItemsBulk } from "../../capi/actions";
import { deleteLot, updateLot } from "../actions";
import { LotForm } from "../LotForm";
import { getMembership } from "@/lib/team/membership";

export const metadata = { title: "Lotto · Vintage Business OS" };

const toneClass = { neutral: "text-stone-700", good: "text-green-800", bad: "text-red-800" };

export default async function LottoDetailPage(props: PageProps<"/lotti/[id]">) {
  const canDelete = (await getMembership())?.role === "owner";
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const { lots, items, sales } = await getBusinessData();
  const lot = lots.find((l) => l.id === id);
  if (!lot) notFound();

  const lotItems = items.filter((i) => i.lot_id === id).sort((a, b) => a.code.localeCompare(b.code));
  const metricLot = toMetricLot(lot);
  const metricItems = toMetricItems(lotItems, sales);
  const m = computeDashboard([metricLot], metricItems);
  const perItemCost = allocatedItemCost(metricLot);
  const metricById = new Map(metricItems.map((i) => [i.id, i]));

  return (
    <>
      <Link href="/lotti" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">
        ← Tutti i lotti
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">Lotto {lot.code}</h1>
        </div>
        <p className="mt-1 text-sm text-stone-600">
          {lot.supplier_name ?? "Fornitore non indicato"}
          {" · acquistato il "}
          {formatDate(lot.purchased_at)}
          {lot.weight_kg !== null && ` · ${lot.weight_kg} kg`}
          {" · "}
          <Link href={`/calcolatore?lotto=${lot.id}`} className="underline underline-offset-2 hover:text-stone-900">
            Calcola la redditività
          </Link>
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          label="Costo totale del lotto"
          value={formatEuro(m.capitalInvested)}
          hint={`Merce ${formatEuro(lot.purchase_cost_cents)} + spedizione in entrata ${formatEuro(lot.inbound_shipping_cents)} + altri ${formatEuro(lot.other_costs_cents)}`}
        />
        <Stat label="Costo per capo" value={formatEuro(perItemCost)} hint={`Diviso per ${lot.quantity} capi dichiarati`} />
        <Stat label="Margine realizzato" value={formatEuro(m.realizedMargin)} tone={toneOf(m.realizedMargin)} hint={`${m.soldCount} capi venduti`} />
        <Stat label="Saldo cassa" value={formatEuro(m.cashBalance)} tone={toneOf(m.cashBalance)} hint="Incassi netti − costo dell'intero lotto" />
        <Stat label="Incassi" value={formatEuro(m.salesRevenue)} hint="Prezzi effettivi di vendita" />
        <Stat label="Costi di vendita" value={formatEuro(m.saleCosts)} hint="Commissioni, spedizione in uscita, extra" />
        <Stat label="Valore dello stock" value={formatEuro(m.stockValue)} hint={`${m.stockCount} capi in magazzino, al prezzo previsto`} />
        <Stat label="Capi registrati" value={`${lotItems.length}/${lot.quantity}`} hint={lotItems.length > lot.quantity ? "Hai registrato più capi di quelli dichiarati" : undefined} tone={lotItems.length > lot.quantity ? "bad" : "neutral"} />
      </div>

      <div className="mt-5 space-y-5">
        <Section title="Capi del lotto">
          {lotItems.length === 0 ? (
            <p className="text-sm text-stone-500">Nessun capo registrato per questo lotto.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Codice</th>
                    <th className="py-2 pr-3 font-medium">Descrizione</th>
                    <th className="py-2 pr-3 font-medium">Stato</th>
                    <th className="py-2 pr-3 text-right font-medium">Previsto</th>
                    <th className="py-2 text-right font-medium">Profitto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {lotItems.map((i) => {
                    const profit = itemProfit(metricById.get(i.id)!, metricLot);
                    return (
                      <tr key={i.id}>
                        <td className="py-2 pr-3">
                          <Link href={`/capi/${i.id}`} className="font-medium text-stone-900 hover:underline">{i.code}</Link>
                        </td>
                        <td className="py-2 pr-3 text-stone-700">{[i.brand, i.category, i.size].filter(Boolean).join(" · ") || "—"}</td>
                        <td className="py-2 pr-3"><ItemStatusBadge status={i.status} /></td>
                        <td className="py-2 pr-3 text-right tabular-nums">{i.expected_price_cents !== null ? formatEuro(i.expected_price_cents) : "—"}</td>
                        <td className={`py-2 text-right tabular-nums ${profit === null ? "text-stone-400" : toneClass[toneOf(profit)]}`}>
                          {profit === null ? "—" : formatEuro(profit)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-5 grid gap-6 border-t border-stone-100 pt-5 lg:grid-cols-2">
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Aggiungi un capo</h3>
              <p className="mt-1 text-sm text-stone-600">Con tutti i dettagli: marca, categoria, taglia, condizione.</p>
              <Link
                href={`/capi?nuovo=1&nuovolotto=${lot.id}`}
                className="mt-3 inline-block rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
              >
                Nuovo capo
              </Link>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-stone-900">Crea più capi in una volta</h3>
              <p className="mt-1 text-sm text-stone-600">
                Crea capi vuoti con codici progressivi ({lot.code}-001, -002…): poi li completi uno per uno.
              </p>
              <ActionForm action={createItemsBulk} submitLabel="Crea capi" pendingLabel="Creazione…" successMessage="Capi creati." className="mt-2">
                <input type="hidden" name="lot_id" value={lot.id} />
                <Field label="Quanti capi" name="count" defaultValue="10" />
              </ActionForm>
            </div>
          </div>
        </Section>

        {(lot.notes) && (
          <Section title="Note">
            <p className="whitespace-pre-wrap text-sm text-stone-700">{lot.notes}</p>
          </Section>
        )}

        <Section title="Modifica lotto">
          <details>
            <summary className="cursor-pointer text-sm font-medium text-stone-700 hover:text-stone-900">
              Apri il modulo di modifica
            </summary>
            <div className="mt-4">
              <LotForm action={updateLot.bind(null, lot.id)} lot={lot} submitLabel="Salva modifiche" />
            </div>
            <div className="mt-6 border-t border-stone-100 pt-4">
              {canDelete && (
              <ActionForm
                action={deleteLot.bind(null, lot.id)}
                submitLabel="Elimina lotto"
                pendingLabel="Eliminazione…"
                successMessage={null}
                variant="danger"
                confirm="Eliminare definitivamente questo lotto, i suoi capi e le loro foto? Non si può annullare."
              >
                <p className="mb-3 text-sm text-stone-600">
                  Elimina il lotto insieme a tutti i suoi capi e alle foto. Non si può fare se qualche capo è stato venduto.
                </p>
                <Field label="Password del tuo account" name="password" type="password" required />
              </ActionForm>
              )}
            </div>
          </details>
        </Section>
      </div>
    </>
  );
}
