import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { ItemStatusBadge, Tag, toneOf } from "@/components/ui";
import { ITEM_STATUSES, ITEM_STATUS_LABELS } from "@/lib/business/constants";
import { toMetricItems, toMetricLot } from "@/lib/business/mappers";
import { getBusinessData, getFirstPhotoUrls } from "@/lib/business/queries";
import { formatEuro, itemProfit } from "@/lib/metrics";

export const metadata = { title: "Capi · Vintage Business OS" };

const MAX_ROWS = 200;
const toneClass = { neutral: "text-stone-700", good: "text-green-800", bad: "text-red-800" };
const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none";

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

function listHref(params: { q?: string; status?: string; lot?: string }): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
  const qs = sp.toString();
  return qs ? `/capi?${qs}` : "/capi";
}

export default async function CapiPage(props: PageProps<"/capi">) {
  const params = await props.searchParams;
  const q = pick(params.q).trim();
  const status = pick(params.status);
  const lotFilter = pick(params.lot);

  const { lots, items, sales } = await getBusinessData();
  const lotById = new Map(lots.map((l) => [l.id, l]));
  const metricLotById = new Map(lots.map((l) => [l.id, toMetricLot(l)]));
  const metricItemById = new Map(toMetricItems(items, sales).map((i) => [i.id, i]));

  const statusCounts = new Map<string, number>();
  for (const i of items) statusCounts.set(i.status, (statusCounts.get(i.status) ?? 0) + 1);

  const needle = q.toLowerCase();
  const filtered = items
    .filter((i) => !status || i.status === status)
    .filter((i) => !lotFilter || i.lot_id === lotFilter)
    .filter(
      (i) =>
        !needle ||
        [i.code, i.brand, i.category, i.size].some((v) => v?.toLowerCase().includes(needle)),
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  const shown = filtered.slice(0, MAX_ROWS);
  const photos = await getFirstPhotoUrls(shown.map((i) => i.id));
  const hasFilters = Boolean(q || status || lotFilter);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Capi"
          description="Inventario dei singoli capi, dal controllo alla vendita."
        />
        <div className="flex gap-2">
          {/* Download di un file: <a download>, non Link, che precaricherebbe (cioè eseguirebbe) l'esportazione. */}
          <a
            href="/esporta/capi"
            download
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Esporta CSV
          </a>
          <Link href="/capi/nuovo" className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">
            Nuovo capo
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={listHref({ q, lot: lotFilter })}
          className={`rounded-full px-3 py-1 text-sm ${!status ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"}`}
        >
          Tutti ({items.length})
        </Link>
        {ITEM_STATUSES.map((s) => (
          <Link
            key={s}
            href={listHref({ q, status: s, lot: lotFilter })}
            className={`rounded-full px-3 py-1 text-sm ${status === s ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"}`}
          >
            {ITEM_STATUS_LABELS[s]} ({statusCounts.get(s) ?? 0})
          </Link>
        ))}
      </div>

      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-3">
        {status && <input type="hidden" name="status" value={status} />}
        <div>
          <label htmlFor="q" className="block text-xs font-medium text-stone-600">Cerca (codice, marca, categoria, taglia)</label>
          <input id="q" name="q" defaultValue={q} className={inputClass} />
        </div>
        <div>
          <label htmlFor="lot" className="block text-xs font-medium text-stone-600">Lotto</label>
          <select id="lot" name="lot" defaultValue={lotFilter} className={inputClass}>
            <option value="">Tutti</option>
            {[...lots].sort((a, b) => a.code.localeCompare(b.code)).map((l) => (
              <option key={l.id} value={l.id}>{l.code}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">Cerca</button>
          {hasFilters && <Link href="/capi" className="px-2 py-2 text-sm text-stone-600 hover:text-stone-900">Azzera filtri</Link>}
        </div>
      </form>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-sm font-medium text-stone-900">
            {hasFilters ? "Nessun capo corrisponde ai filtri." : "Non hai ancora registrato nessun capo."}
          </p>
          {!hasFilters && (
            <p className="mt-1 text-sm text-stone-600">
              Registra prima un lotto, poi aggiungi i capi dalla sua scheda (anche tanti insieme).
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="w-16 px-4 py-3 font-medium"><span className="sr-only">Foto</span></th>
                  <th className="px-4 py-3 font-medium">Capo</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                  <th className="px-4 py-3 font-medium">Lotto</th>
                  <th className="px-4 py-3 text-right font-medium">Previsto</th>
                  <th className="px-4 py-3 text-right font-medium">Profitto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {shown.map((i) => {
                  const lot = lotById.get(i.lot_id);
                  const profit = itemProfit(metricItemById.get(i.id)!, metricLotById.get(i.lot_id)!);
                  const photo = photos.get(i.id);
                  return (
                    <tr key={i.id} className="hover:bg-stone-50">
                      <td className="px-4 py-2">
                        {photo ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo} alt="" className="h-12 w-12 rounded object-cover" />
                        ) : (
                          <div className="h-12 w-12 rounded bg-stone-100" />
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Link href={`/capi/${i.id}`} className="font-medium text-stone-900 hover:underline">{i.code}</Link>
                        <div className="text-xs text-stone-500">
                          {[i.brand, i.category, i.size].filter(Boolean).join(" · ") || "—"}
                          {i.is_demo && <> <Tag>DEMO</Tag></>}
                        </div>
                      </td>
                      <td className="px-4 py-2"><ItemStatusBadge status={i.status} /></td>
                      <td className="px-4 py-2 text-stone-700">{lot?.code ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{i.expected_price_cents !== null ? formatEuro(i.expected_price_cents) : "—"}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${profit === null ? "text-stone-400" : toneClass[toneOf(profit)]}`}>
                        {profit === null ? "—" : formatEuro(profit)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {filtered.length > MAX_ROWS && (
            <p className="mt-3 text-sm text-stone-600">
              Mostrati i primi {MAX_ROWS} di {filtered.length} capi: restringi la ricerca per vedere gli altri.
            </p>
          )}
        </>
      )}
    </>
  );
}
