import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { ActionForm } from "@/components/form";
import { formatDate } from "@/components/ui";
import { AREA_LABELS, BOX_TYPE_INFO, parseArea, type BoxType } from "@/lib/search/queries";
import { existingSuppliersByDomain, listAllCompanies, listRuns } from "@/lib/search/store";
import { CandidateCard } from "../CandidateCard";
import { deleteRun } from "../actions";

export const metadata = { title: "Tutte le ricerche · Vintage Business OS" };

export default async function StoricoPage(props: PageProps<"/ricerca/storico">) {
  const sp = await props.searchParams;
  const showRetail = (Array.isArray(sp.rivenditori) ? sp.rivenditori[0] : sp.rivenditori) === "1";

  const [runs, companies, existing] = await Promise.all([listRuns(), listAllCompanies(), existingSuppliersByDomain()]);
  const visible = (showRetail ? companies : companies.filter((c) => c.likelihood !== "rivenditore")).slice(0, 200);

  return (
    <>
      <Link href="/ricerca" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">← Nuova ricerca</Link>
      <PageHeader title="Tutte le ricerche" description="Lo storico delle ricerche salvate e tutte le aziende trovate, senza doppioni." />

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Ricerche ({runs.length})</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-stone-500">Nessuna ricerca salvata.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
            {runs.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div>
                  <Link href={`/ricerca/${r.id}`} className="font-medium text-stone-900 hover:underline">
                    {[r.product || "tutti i prodotti", r.term].filter(Boolean).join(" · ")} · {AREA_LABELS[parseArea(r.area)]}
                  </Link>
                  <p className="text-xs text-stone-500">
                    {formatDate(r.created_at)} · {r.result_count} aziende · {r.queries.length} ricerche
                    {r.box_types.length > 0 && ` · ${r.box_types.map((t) => BOX_TYPE_INFO[t as BoxType]?.label ?? t).join(", ")}`}
                  </p>
                </div>
                <ActionForm
                  action={deleteRun.bind(null, r.id)}
                  submitLabel="Elimina"
                  pendingLabel="…"
                  successMessage={null}
                  variant="danger"
                  confirm="Eliminare questa ricerca e i suoi risultati? I fornitori già aggiunti restano."
                />
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-stone-900">Tutte le aziende trovate ({visible.length})</h2>
          <Link href={showRetail ? "/ricerca/storico" : "/ricerca/storico?rivenditori=1"} className="text-sm font-medium text-stone-900 underline">
            {showRetail ? "Nascondi i rivenditori" : "Mostra anche i rivenditori"}
          </Link>
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-stone-500">Nessuna azienda ancora.</p>
        ) : (
          <ul className="space-y-3">
            {visible.map((c) => (
              <CandidateCard key={c.domain} c={c} existingId={existing.get(c.domain)} extra={c.runs > 1 ? `trovata in ${c.runs} ricerche` : undefined} />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
