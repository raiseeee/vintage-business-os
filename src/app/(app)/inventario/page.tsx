import { ActionForm } from "@/components/form";
import { ModalButton } from "@/components/Modal";
import { PageHeader } from "@/components/PagePlaceholder";
import { Section, Stat, Tag, formatDate } from "@/components/ui";
import { todayIso } from "@/lib/dates";
import {
  formatUnitEuro,
  investmentsTotal,
  materialsCostPerItem,
  perItemCostCents,
  unitCostCents,
} from "@/lib/inventory/calc";
import { getInventory } from "@/lib/inventory/queries";
import { formatEuro } from "@/lib/metrics";
import { getMembership } from "@/lib/team/membership";
import { createInventoryItem, deleteInventoryItem, setInUse, updateInventoryItem } from "./actions";
import { InventoryForm } from "./InventoryForm";

export const metadata = { title: "Inventario · Vintage Business OS" };

export default async function InventarioPage() {
  const canDelete = (await getMembership())?.role === "owner";
  const { rows, available } = await getInventory();
  const today = todayIso();

  if (!available) {
    return (
      <>
        <PageHeader title="Inventario" description="Materiali di consumo e attrezzature." />
        <p className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Il database non ha ancora la tabella dell&apos;inventario. Applica la migrazione{" "}
          <code className="rounded bg-white px-1">20261026000001_inventory.sql</code> dallo SQL Editor di Supabase (istruzioni nel README).
        </p>
      </>
    );
  }

  const materials = rows.filter((r) => r.kind === "materiale");
  const equipment = rows.filter((r) => r.kind === "attrezzatura");
  const perItem = materialsCostPerItem(rows);

  return (
    <>
      <PageHeader
        title="Inventario"
        description="Le spese fisse dell'attività, senza l'affitto. I materiali entrano nel costo di ogni capo venduto; le attrezzature sono investimenti a parte."
      />

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="grid flex-1 gap-4 sm:grid-cols-2 xl:max-w-2xl">
          <Stat label="Materiali per capo" value={formatEuro(perItem)} hint="Somma dei materiali «in uso»: si sottrae a ogni vendita nuova" />
          <Stat label="Investimenti in attrezzature" value={formatEuro(investmentsTotal(rows))} hint="Non entra nel costo dei capi" />
        </div>
        <ModalButton label="Aggiungi" title="Aggiungi all'inventario" description="Un materiale di consumo oppure un'attrezzatura.">
          <InventoryForm action={createInventoryItem} today={today} submitLabel="Aggiungi" />
        </ModalButton>
      </div>

      <div className="space-y-6">
        <Section
          title="Materiali di consumo"
          description="Sacchetti, scatole, etichette… Il costo di un capo è il costo unitario × quantità per capo. Il valore viene congelato al momento della vendita: cambiare i prezzi dopo non modifica i profitti già registrati."
        >
          {materials.length === 0 ? (
            <p className="text-sm text-stone-600">Nessun materiale. Esempio: 100 sacchetti a 10 € → 0,10 € l&apos;uno, per ogni capo spedito.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Voce</th>
                    <th className="py-2 pr-4 text-right font-medium">Costo totale</th>
                    <th className="py-2 pr-4 text-right font-medium">Quantità</th>
                    <th className="py-2 pr-4 text-right font-medium">Costo unitario</th>
                    <th className="py-2 pr-4 text-right font-medium">Per capo</th>
                    <th className="py-2 pr-4 text-right font-medium">Costo per capo</th>
                    <th className="py-2 pr-4 font-medium">Stato</th>
                    <th className="py-2 font-medium"><span className="sr-only">Azioni</span></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {materials.map((r) => (
                    <tr key={r.id}>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-stone-900">{r.name}</p>
                        <p className="text-xs text-stone-500">Acquistato il {formatDate(r.purchased_at)}</p>
                      </td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatEuro(r.total_cost_cents)}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.quantity}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{formatUnitEuro(unitCostCents(r))}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{String(r.per_item_qty).replace(".", ",")}</td>
                      <td className="py-3 pr-4 text-right tabular-nums">{r.in_use ? formatUnitEuro(perItemCostCents(r)) : "—"}</td>
                      <td className="py-3 pr-4">{r.in_use ? <Tag>In uso</Tag> : <span className="text-xs text-stone-500">Non conta</span>}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <ActionForm
                            action={setInUse.bind(null, r.id, !r.in_use)}
                            submitLabel={r.in_use ? "Smetti di contare" : "Metti in uso"}
                            pendingLabel="…"
                            successMessage={null}
                            variant="quiet"
                          />
                          <ModalButton label="Modifica" title={`Modifica ${r.name}`} variant="link">
                            <InventoryForm action={updateInventoryItem.bind(null, r.id)} item={r} today={today} submitLabel="Salva modifiche" />
                          </ModalButton>
                          {canDelete && (
                            <ActionForm
                              action={deleteInventoryItem.bind(null, r.id)}
                              submitLabel="Elimina"
                              pendingLabel="…"
                              successMessage={null}
                              variant="danger"
                              confirm={`Eliminare «${r.name}»? Le vendite già registrate non cambiano.`}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          title="Attrezzature e investimenti"
          description="Cose comprate una volta (stampante per le etichette…). Non sono distribuite sui capi: le trovi nelle Statistiche come investimento da recuperare."
        >
          {equipment.length === 0 ? (
            <p className="text-sm text-stone-600">Nessuna attrezzatura.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {equipment.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-sm font-medium text-stone-900">{r.name}</p>
                    <p className="text-xs text-stone-500">Acquistato il {formatDate(r.purchased_at)}{r.notes ? ` · ${r.notes}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm font-medium tabular-nums">{formatEuro(r.total_cost_cents)}</span>
                    <ModalButton label="Modifica" title={`Modifica ${r.name}`} variant="link">
                      <InventoryForm action={updateInventoryItem.bind(null, r.id)} item={r} today={today} submitLabel="Salva modifiche" />
                    </ModalButton>
                    {canDelete && (
                      <ActionForm
                        action={deleteInventoryItem.bind(null, r.id)}
                        submitLabel="Elimina"
                        pendingLabel="…"
                        successMessage={null}
                        variant="danger"
                        confirm={`Eliminare «${r.name}»?`}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="max-w-3xl text-xs text-stone-500">
          Lavaggio e altri costi di un singolo lotto non vanno qui: inseriscili negli «altri costi» del lotto, così non vengono contati due volte.
          Le vendite registrate prima di aver compilato l&apos;inventario non hanno materiali congelati.
        </p>
      </div>
    </>
  );
}
