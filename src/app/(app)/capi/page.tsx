import Link from "next/link";
import { ModalButton } from "@/components/Modal";
import { PageHeader } from "@/components/PagePlaceholder";
import { ItemStatusBadge, toneOf } from "@/components/ui";
import { ITEM_STATUSES, ITEM_STATUS_LABELS } from "@/lib/business/constants";
import { toMetricItems, toMetricLot } from "@/lib/business/mappers";
import { getBusinessData, getFirstPhotoUrls } from "@/lib/business/queries";
import { formatDate } from "@/components/ui";
import { allocatedItemCost, formatEuro, itemProfit } from "@/lib/metrics";
import { getMembership } from "@/lib/team/membership";
import { ImportForm } from "./ImportForm";
import { NewItemForm } from "./NewItemForm";
import { QuickAction } from "./QuickAction";

export const metadata = { title: "Capi · Vintage Business OS" };

const MAX_ROWS = 200;
const toneClass = { neutral: "text-stone-700", good: "text-green-800", bad: "text-red-800" };
const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none";

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

const ALL_LOTS = "tutti";

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

  const currentLot = lotFilter && lotFilter !== ALL_LOTS ? lotById.get(lotFilter) : undefined;
  // Prima si sceglie il lotto: senza lotto valido (né «tutti») si mostra la scelta del lotto.
  const choosingLot = !currentLot && lotFilter !== ALL_LOTS;
  const scopeItems = lotFilter === ALL_LOTS ? items : items.filter((i) => i.lot_id === lotFilter);

  const statusCounts = new Map<string, number>();
  for (const i of scopeItems) statusCounts.set(i.status, (statusCounts.get(i.status) ?? 0) + 1);

  const needle = q.toLowerCase();
  const filtered = items
    .filter((i) => !status || i.status === status)
    .filter((i) => lotFilter === ALL_LOTS || i.lot_id === lotFilter)
    .filter(
      (i) =>
        !needle ||
        [i.code, i.brand, i.category, i.size].some((v) => v?.toLowerCase().includes(needle)),
    )
    .sort((a, b) => a.code.localeCompare(b.code));

  // Modal "Nuovo capo": lotto preselezionato (parametro ?nuovolotto, distinto dal filtro ?lotto) e codice suggerito.
  const lotParam = pick(params.nuovolotto) || (lotFilter && lotFilter !== ALL_LOTS ? lotFilter : "");
  const sortedLots = [...lots].sort((a, b) => b.purchased_at.localeCompare(a.purchased_at));
  const selected = sortedLots.find((l) => l.id === lotParam) ?? sortedLots[0];
  let suggested = "";
  if (selected) {
    const prefix = `${selected.code}-`;
    const used = items
      .filter((i) => i.lot_id === selected.id && i.code.startsWith(prefix))
      .map((i) => Number(i.code.slice(prefix.length)))
      .filter(Number.isFinite);
    suggested = `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
  }

  const membership = await getMembership();
  const businessId = membership?.businessId ?? "";

  const shown = filtered.slice(0, MAX_ROWS);
  const photos = await getFirstPhotoUrls(shown.map((i) => i.id));
  const hasFilters = Boolean(q || status);

  return (
    <>
      <PageHeader
          title={currentLot ? `Capi del lotto ${currentLot.code}` : "Capi"}
        back={currentLot ? { href: "/capi", label: "Tutti i lotti" } : undefined}
          description={
            currentLot
              ? `${currentLot.supplier_name ? `${currentLot.supplier_name} · ` : ""}acquistato il ${formatDate(currentLot.purchased_at)}`
              : choosingLot
                ? "Scegli un lotto per vedere i suoi capi."
                : "Tutti i capi, di tutti i lotti."
          }
        actions={
          <>
          {/* Download di un file: <a download>, non Link, che precaricherebbe (cioè eseguirebbe) l'esportazione. */}
          <a
            href="/esporta/capi"
            download
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            Esporta CSV
          </a>
          {sortedLots.length > 0 && (
            <ModalButton
              label="Importa CSV"
              title="Importa capi da CSV"
              description="Tanti capi in un colpo solo, con codici e stato assegnati dall'app."
              variant="secondary"
              defaultOpen={pick(params.importa) === "1"}
            >
              <ImportForm lots={sortedLots} defaultLotId={selected?.id} />
            </ModalButton>
          )}
          <ModalButton
            label="Nuovo capo"
            title="Nuovo capo"
            description="Puoi aggiungere subito le foto, oppure dopo dalla scheda del capo."
            defaultOpen={pick(params.nuovo) === "1"}
          >
            {sortedLots.length === 0 ? (
              <p className="text-sm text-stone-700">
                Ogni capo appartiene a un lotto.{" "}
                <Link href="/lotti?nuovo=1" className="font-medium text-stone-900 underline">Registra prima un lotto</Link>.
              </p>
            ) : (
              <NewItemForm lots={sortedLots} defaults={{ lotId: selected?.id, code: suggested }} businessId={businessId} />
            )}
          </ModalButton>
          </>
        }
      />

      {choosingLot ? (
        sortedLots.length === 0 ? (
          <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
            <p className="text-sm font-medium text-stone-900">Non hai ancora registrato nessun lotto.</p>
            <p className="mt-1 text-sm text-stone-600">
              Ogni capo appartiene a un lotto: <Link href="/lotti?nuovo=1" className="underline">registra prima un acquisto</Link>.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="px-4 py-3 font-medium">Lotto</th>
                    <th className="px-4 py-3 text-right font-medium">Capi</th>
                    <th className="px-4 py-3 font-medium">Stato dei capi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {sortedLots.map((l) => {
                    const own = items.filter((i) => i.lot_id === l.id);
                    const counts = ITEM_STATUSES.map((st) => [st, own.filter((i) => i.status === st).length] as const).filter(([, n]) => n > 0);
                    return (
                      <tr key={l.id} className="hover:bg-stone-50">
                        <td className="px-4 py-3">
                          <Link href={`/capi?lot=${l.id}`} className="font-medium text-stone-900 underline-offset-2 hover:underline">{l.code}</Link>
                          <p className="text-xs text-stone-500">{l.supplier_name ? `${l.supplier_name} · ` : ""}{formatDate(l.purchased_at)}</p>
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums">
                          {own.length}
                          {own.length < l.quantity && <span className="block text-xs text-stone-500">su {l.quantity} dichiarati</span>}
                        </td>
                        <td className="px-4 py-3">
                          {counts.length === 0 ? (
                            <span className="text-stone-400">Nessun capo ancora</span>
                          ) : (
                            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-stone-700">
                              {counts.map(([st, n]) => (
                                <span key={st}>{n} {ITEM_STATUS_LABELS[st].toLowerCase()}</span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-sm text-stone-600">
              Ti serve cercare un capo senza sapere il lotto?{" "}
              <Link href={`/capi?lot=${ALL_LOTS}`} className="underline">Vedi tutti i capi insieme</Link>.
            </p>
          </>
        )
      ) : (
        <>
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={listHref({ q, lot: lotFilter })}
          className={`rounded-full px-3 py-1 text-sm ${!status ? "bg-stone-900 text-white" : "bg-white text-stone-700 ring-1 ring-stone-200 hover:bg-stone-50"}`}
        >
          Tutti ({scopeItems.length})
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

      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-[2fr_1fr_auto]">
        {status && <input type="hidden" name="status" value={status} />}
        <div>
          <label htmlFor="q" className="block text-xs font-medium text-stone-600">Cerca (codice, marca, categoria, taglia)</label>
          <input id="q" name="q" defaultValue={q} className={inputClass} />
        </div>
        {currentLot ? (
          <input type="hidden" name="lot" value={currentLot.id} />
        ) : (
          <div>
            <label htmlFor="lot" className="block text-xs font-medium text-stone-600">Lotto</label>
            <select id="lot" name="lot" defaultValue={lotFilter} className={inputClass}>
              <option value={ALL_LOTS}>Tutti i lotti</option>
              {[...lots].sort((a, b) => a.code.localeCompare(b.code)).map((l) => (
                <option key={l.id} value={l.id}>{l.code}</option>
              ))}
            </select>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button type="submit" className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700">Cerca</button>
          {hasFilters && <Link href={listHref({ lot: lotFilter })} className="px-2 py-2 text-sm text-stone-600 hover:text-stone-900">Azzera filtri</Link>}
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
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-stone-200 bg-stone-50 text-xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th className="w-16 px-4 py-3 font-medium"><span className="sr-only">Foto</span></th>
                  <th className="px-4 py-3 font-medium">Capo</th>
                  <th className="px-4 py-3 font-medium">Stato</th>
                  <th className="px-4 py-3 font-medium">Lotto</th>
                  <th className="px-4 py-3 text-right font-medium">Costo unitario</th>
                  <th className="px-4 py-3 text-right font-medium">Previsto</th>
                  <th className="px-4 py-3 text-right font-medium">Profitto</th>
                  <th className="px-4 py-3 text-right font-medium"><span className="sr-only">Azione</span></th>
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
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        <ItemStatusBadge status={i.status} />
                        {i.status === "pubblicato" && i.listing_channel && <div className="mt-1 text-xs text-stone-500">su {i.listing_channel}</div>}
                      </td>
                      <td className="px-4 py-2 text-stone-700">{lot?.code ?? "—"}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{formatEuro(allocatedItemCost(metricLotById.get(i.lot_id)!))}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{i.expected_price_cents !== null ? formatEuro(i.expected_price_cents) : "—"}</td>
                      <td className={`px-4 py-2 text-right tabular-nums ${profit === null ? "text-stone-400" : toneClass[toneOf(profit)]}`}>
                        {profit === null ? "—" : formatEuro(profit)}
                      </td>
                      <td className="px-4 py-2 text-right"><QuickAction item={i} /></td>
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
      )}
    </>
  );
}
