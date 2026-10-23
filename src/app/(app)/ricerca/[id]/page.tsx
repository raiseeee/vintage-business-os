import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/PagePlaceholder";
import { formatDate } from "@/components/ui";
import { AREA_LABELS, BOX_TYPE_INFO, parseArea, type BoxType } from "@/lib/search/queries";
import { existingSuppliersByDomain, getRun } from "@/lib/search/store";
import { uuidSchema } from "@/lib/suppliers/schemas";
import { CandidateCard } from "../CandidateCard";

export const metadata = { title: "Risultati ricerca · Vintage Business OS" };

export default async function RunPage(props: PageProps<"/ricerca/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const sp = await props.searchParams;
  const showRetail = (Array.isArray(sp.rivenditori) ? sp.rivenditori[0] : sp.rivenditori) === "1";

  const data = await getRun(id);
  if (!data) notFound();
  const { run, results } = data;
  const existing = await existingSuppliersByDomain();

  const hidden = results.filter((r) => r.likelihood === "rivenditore").length;
  const visible = showRetail ? results : results.filter((r) => r.likelihood !== "rivenditore");
  const types = run.box_types.map((t) => BOX_TYPE_INFO[t as BoxType]?.label ?? t);

  return (
    <>
      <Link href="/ricerca/storico" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">← Tutte le ricerche</Link>
      <PageHeader
        title={[run.product || "Tutti i prodotti", run.term].filter(Boolean).join(" · ")}
        description={`${AREA_LABELS[parseArea(run.area)]} · ${formatDate(run.created_at)} · ${run.provider} · ${run.queries.length} ricerche${run.queries_failed ? ` (${run.queries_failed} non riuscite)` : ""}${types.length ? ` · ${types.join(", ")}` : ""}`}
      />

      <div className="mb-4 flex flex-wrap items-center gap-4 text-sm">
        <span className="text-stone-600">{visible.length} aziende{!showRetail && hidden > 0 ? ` (${hidden} probabili rivenditori nascosti)` : ""}</span>
        {hidden > 0 && (
          <Link href={showRetail ? `/ricerca/${id}` : `/ricerca/${id}?rivenditori=1`} className="font-medium text-stone-900 underline">
            {showRetail ? "Nascondi i rivenditori" : "Mostra anche i rivenditori"}
          </Link>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-700">
          Nessun risultato utile. Prova altre parole, un altro Paese o una ricerca più approfondita.
        </div>
      ) : (
        <ul className="space-y-3">
          {visible.map((c) => (
            <CandidateCard key={c.id} c={c} existingId={existing.get(c.domain)} />
          ))}
        </ul>
      )}

      <details className="mt-6 text-sm text-stone-600">
        <summary className="cursor-pointer font-medium text-stone-700">Query lanciate ({run.queries.length})</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-xs">
          {run.queries.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      </details>

      <p className="mt-4 max-w-3xl text-xs text-stone-500">
        Il giudizio si basa solo sulle parole del risultato: è un indizio, non una prova. Un fornitore aggiunto parte sempre come
        «origine non verificata»; per promuoverlo serve una fonte che documenti la provenienza.
      </p>
    </>
  );
}
