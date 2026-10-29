import Link from "next/link";
import { ModalButton } from "@/components/Modal";
import { PageHeader } from "@/components/PagePlaceholder";
import { formatDate, toneOf } from "@/components/ui";
import { toMetricItems, toMetricLot } from "@/lib/business/mappers";
import { getBusinessData } from "@/lib/business/queries";
import { todayIso } from "@/lib/dates";
import { formatEuro, summarizeByLot } from "@/lib/metrics";
import { createLot } from "./actions";
import { LotForm } from "./LotForm";

export const metadata = { title: "Acquisti e lotti · ARCHVNT" };

const toneClass = { neutral: "text-stone-700", good: "text-stone-900", bad: "text-stone-900" };

export default async function LottiPage(props: PageProps<"/lotti">) {
  const params = await props.searchParams;
  const openNew = (Array.isArray(params.nuovo) ? params.nuovo[0] : params.nuovo) === "1";
  const { lots, items, sales } = await getBusinessData();

  const summaries = summarizeByLot(lots.map(toMetricLot), toMetricItems(items, sales));
  const registered = new Map<string, number>();
  for (const i of items) registered.set(i.lot_id, (registered.get(i.lot_id) ?? 0) + 1);

  const sorted = [...lots].sort((a, b) => b.purchased_at.localeCompare(a.purchased_at) || b.code.localeCompare(a.code));

  return (
    <>
      <PageHeader
        title="Acquisti e lotti"
        description="Ogni lotto con i suoi costi e il risultato economico dei capi venduti."
        actions={
          <>
          {/* Download di un file: <a download>, non Link, che precaricherebbe (cioè eseguirebbe) l'esportazione. */}
          <a
            href="/esporta/lotti"
            download
            className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-700 hover:bg-stone-50"
          >
            Esporta CSV
          </a>
          <ModalButton
            label="Nuovo lotto"
            title="Nuovo lotto"
            description="Registra un acquisto. I costi del lotto si ripartiscono sui capi; quelli di vendita si inseriscono sul singolo capo."
            defaultOpen={openNew}
          >
            <LotForm
              action={createLot}
              defaults={{
                code: `L-${String(lots.length + 1).padStart(3, "0")}`,
                purchasedAt: todayIso(),
              }}
              submitLabel="Crea lotto"
            />
          </ModalButton>
          </>
        }
      />

      {sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-sm font-semibold text-stone-900">Non hai ancora registrato nessun lotto.</p>
          <p className="mt-2 text-sm text-stone-600">
            Registra qui il tuo primo acquisto con «Nuovo lotto».
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full min-w-[864px] text-left text-sm">
            <thead className="border-b border-stone-200 bg-stone-50 text-xs text-stone-500">
              <tr>
                <th className="px-4 py-4 font-semibold">Lotto</th>
                <th className="px-4 py-4 font-semibold">Fornitore</th>
                <th className="px-4 py-4 text-right font-semibold">Capi</th>
                <th className="px-4 py-4 text-right font-semibold">Costo totale</th>
                <th className="px-4 py-4 text-right font-semibold">Venduti</th>
                <th className="px-4 py-4 text-right font-semibold">Margine realizzato</th>
                <th className="px-4 py-4 text-right font-semibold">Saldo cassa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {sorted.map((lot) => {
                const m = summaries.get(lot.id)!;
                const n = registered.get(lot.id) ?? 0;
                return (
                  <tr key={lot.id} className="hover:bg-stone-50">
                    <td className="px-4 py-4">
                      <Link href={`/lotti/${lot.id}`} className="font-semibold text-stone-900 hover:underline">
                        {lot.code}
                      </Link>
                      <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
                        {formatDate(lot.purchased_at)}
                      </div>
                    </td>
                    <td className="px-4 py-4 text-stone-700">{lot.supplier_name ?? "—"}</td>
                    <td className="px-4 py-4 text-right tabular-nums text-stone-700">
                      {n}/{lot.quantity}
                    </td>
                    <td className="px-4 py-4 text-right tabular-nums">{formatEuro(m.capitalInvested)}</td>
                    <td className="px-4 py-4 text-right tabular-nums">{m.soldCount}</td>
                    <td className={`px-4 py-4 text-right font-semibold tabular-nums ${toneClass[toneOf(m.realizedMargin)]}`}>
                      {formatEuro(m.realizedMargin)}
                    </td>
                    <td className={`px-4 py-4 text-right tabular-nums ${toneClass[toneOf(m.cashBalance)]}`}>
                      {formatEuro(m.cashBalance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-4 max-w-3xl text-xs text-stone-500">
        <strong>Margine realizzato</strong>: incassi − costi di vendita − costo dei soli capi venduti.{" "}
        <strong>Saldo cassa</strong>: incassi netti − costo dell&apos;intero lotto (negativo finché non lo hai recuperato).
        «Capi» mostra quelli registrati sul totale dichiarato.
      </p>
    </>
  );
}
