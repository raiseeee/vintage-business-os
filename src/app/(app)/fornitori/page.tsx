import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { ActionForm } from "@/components/form";
import { SupplierTypeBadge, Tag } from "@/components/ui";
import { formatEuro } from "@/lib/metrics";
import { getWebSearchProvider } from "@/lib/search/provider";
import {
  CONTACT_STATUS_LABELS,
  SUPPLIER_TYPES,
  SUPPLIER_TYPE_LABELS,
} from "@/lib/suppliers/constants";
import { hasDemoData, listSuppliers, type SupplierListItem } from "@/lib/suppliers/queries";
import type { SupplierFilters } from "@/lib/suppliers/types";
import { clearDemoData, loadDemoData } from "./actions";

export const metadata = { title: "Supplier Finder · Vintage Business OS" };

const FILTER_KEYS = ["q", "country", "language", "stock", "brand", "type"] as const;

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function moqSummary(s: SupplierListItem): string {
  const parts: string[] = [];
  if (s.min_order_qty !== null) parts.push(`${s.min_order_qty} capi`);
  if (s.min_order_weight_kg !== null) parts.push(`${s.min_order_weight_kg} kg`);
  if (s.min_order_value_cents !== null) parts.push(formatEuro(s.min_order_value_cents));
  return parts.length ? parts.join(" · ") : "—";
}

const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none";

export default async function FornitoriPage(props: PageProps<"/fornitori">) {
  const params = await props.searchParams;
  const filters: SupplierFilters = {};
  for (const key of FILTER_KEYS) filters[key] = pick(params[key]);
  const hasFilters = FILTER_KEYS.some((k) => filters[k]);

  const [suppliers, demoPresent] = await Promise.all([listSuppliers(filters), hasDemoData()]);
  const searchProvider = getWebSearchProvider();

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Supplier Finder"
          description="Fornitori con fonti verificabili: separa ciò che è documentato da ciò che è solo dichiarato o ipotizzato."
        />
        <Link
          href="/fornitori/nuovo"
          className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700"
        >
          Nuovo fornitore
        </Link>
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
        <div className="sm:col-span-3 lg:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-stone-600">Nome</label>
          <input id="q" name="q" defaultValue={filters.q} className={inputClass} />
        </div>
        <div>
          <label htmlFor="country" className="block text-xs font-medium text-stone-600">Paese</label>
          <input id="country" name="country" defaultValue={filters.country} placeholder="IT" maxLength={2} className={inputClass} />
        </div>
        <div>
          <label htmlFor="language" className="block text-xs font-medium text-stone-600">Lingua</label>
          <input id="language" name="language" defaultValue={filters.language} placeholder="de" className={inputClass} />
        </div>
        <div>
          <label htmlFor="stock" className="block text-xs font-medium text-stone-600">Tipologia stock</label>
          <input id="stock" name="stock" defaultValue={filters.stock} placeholder="sportswear" className={inputClass} />
        </div>
        <div>
          <label htmlFor="brand" className="block text-xs font-medium text-stone-600">Marchio</label>
          <input id="brand" name="brand" defaultValue={filters.brand} className={inputClass} />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label htmlFor="type" className="block text-xs font-medium text-stone-600">Tipo di fornitore</label>
          <select id="type" name="type" defaultValue={filters.type} className={inputClass}>
            <option value="">Tutti</option>
            {SUPPLIER_TYPES.map((t) => (
              <option key={t} value={t}>{SUPPLIER_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2 sm:col-span-1 lg:col-span-3">
          <button type="submit" className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
            Cerca
          </button>
          {hasFilters && (
            <Link href="/fornitori" className="px-2 py-2 text-sm text-stone-600 hover:text-stone-900">
              Azzera filtri
            </Link>
          )}
        </div>
      </form>

      {suppliers.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-stone-900">
            {hasFilters ? "Nessun fornitore corrisponde ai filtri." : "Non hai ancora nessun fornitore."}
          </p>
          {!hasFilters && (
            <p className="mt-1 text-sm text-stone-600">
              Aggiungine uno a mano, oppure carica i dati demo per provare l&apos;app.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
              <tr>
                <th className="px-4 py-3 font-medium">Fornitore</th>
                <th className="px-4 py-3 font-medium">Tipo</th>
                <th className="px-4 py-3 font-medium">Ordine minimo</th>
                <th className="px-4 py-3 font-medium">Contatto</th>
                <th className="px-4 py-3 text-right font-medium">Punteggio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-stone-50">
                  <td className="px-4 py-3">
                    <Link href={`/fornitori/${s.id}`} className="font-medium text-stone-900 hover:underline">
                      {s.name}
                    </Link>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.country && <Tag>{s.country}</Tag>}
                      {s.is_demo && <Tag>DEMO</Tag>}
                      {s.languages.map((l) => <Tag key={l}>{l}</Tag>)}
                    </div>
                  </td>
                  <td className="px-4 py-3"><SupplierTypeBadge type={s.supplier_type} /></td>
                  <td className="px-4 py-3 text-stone-700">{moqSummary(s)}</td>
                  <td className="px-4 py-3 text-stone-700">{CONTACT_STATUS_LABELS[s.contact_status]}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {s.score ? <span className="font-semibold text-stone-900">{s.score.total}/100</span> : <span className="text-stone-400">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">Ricerca web</h2>
          <p className="mt-1 text-sm text-stone-600">
            {searchProvider
              ? `Provider attivo: ${searchProvider.name}.`
              : "Nessuna API di ricerca è collegata. Per ora cerca fornitori a mano e registra qui le fonti trovate: l'app non inventa né simula risultati di ricerca."}
          </p>
          <p className="mt-2 text-xs text-stone-500">
            Quando verrà collegata, i risultati saranno solo suggerimenti da verificare: non
            diventeranno mai fornitori o informazioni «documentate» in automatico.
          </p>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">Dati demo</h2>
          <p className="mt-1 text-sm text-stone-600">
            Esempi fittizi, tutti marcati [DEMO] e con indirizzi example.com, per provare l&apos;app.
            Non sono fornitori reali e si rimuovono con un clic.
          </p>
          {demoPresent ? (
            <ActionForm
              action={clearDemoData}
              submitLabel="Rimuovi dati demo"
              pendingLabel="Rimozione…"
              successMessage="Dati demo rimossi."
              variant="danger"
              confirm="Rimuovere tutti i dati demo? I tuoi dati reali non vengono toccati."
            />
          ) : (
            <ActionForm
              action={loadDemoData}
              submitLabel="Carica dati demo"
              pendingLabel="Caricamento…"
              successMessage="Dati demo caricati."
              variant="quiet"
            />
          )}
        </section>
      </div>
    </>
  );
}
