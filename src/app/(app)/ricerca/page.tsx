import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { formatDate } from "@/components/ui";
import { getWebSearchProvider } from "@/lib/search/provider";
import { AREA_LABELS, parseArea } from "@/lib/search/queries";
import { listRuns } from "@/lib/search/store";
import { SearchForm } from "./SearchForm";

export const metadata = { title: "Ricerca fornitori · Vintage Business OS" };
// La ricerca (server action di questa pagina) può lanciare molte query di seguito.
export const maxDuration = 120;

export default async function RicercaPage() {
  const provider = getWebSearchProvider();
  const recent = await listRuns(5);

  return (
    <>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title="Ricerca fornitori"
          description="Cerca sul web aziende di raccolta, selezione e ingrosso di abiti usati. I risultati sono suggerimenti da verificare e restano salvati."
        />
        <Link href="/ricerca/storico" className="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">
          Tutte le ricerche
        </Link>
      </div>

      {!provider && (
        <div className="mb-6 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">La ricerca web non è ancora collegata.</p>
          <p className="mt-1">
            Serve una chiave di un servizio di ricerca. Inseriscila in <code>.env.local</code> come <code>TAVILY_API_KEY</code> (o{" "}
            <code>BRAVE_SEARCH_API_KEY</code>) e riavvia l&apos;app. L&apos;app non mostra mai risultati inventati.
          </p>
        </div>
      )}

      <SearchForm enabled={Boolean(provider)} />

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-stone-900">Ultime ricerche</h2>
        {recent.length === 0 ? (
          <p className="text-sm text-stone-500">Nessuna ricerca ancora.</p>
        ) : (
          <ul className="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
            {recent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <Link href={`/ricerca/${r.id}`} className="font-medium text-stone-900 hover:underline">
                  {[r.product || "tutti i prodotti", r.term].filter(Boolean).join(" · ")} · {AREA_LABELS[parseArea(r.area)]}
                </Link>
                <span className="text-stone-500">{r.result_count} aziende · {formatDate(r.created_at)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
