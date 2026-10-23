import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { ActionForm } from "@/components/form";
import { ExternalLink } from "@/components/ui";
import { AREAS, AREA_LABELS, buildQueries, parseArea } from "@/lib/search/queries";
import { LIKELIHOOD_LABELS, buildCandidates, domainOf, type Candidate, type Likelihood } from "@/lib/search/classify";
import { getWebSearchProvider, type WebSearchResult } from "@/lib/search/provider";
import { createClient } from "@/lib/supabase/server";
import { addFromSearch } from "./actions";

export const metadata = { title: "Ricerca fornitori · Vintage Business OS" };

const MAX_SHOWN = 60;
const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none";

const BADGE: Record<Likelihood, string> = {
  monte: "bg-green-100 text-green-900",
  incerto: "bg-stone-200 text-stone-800",
  rivenditore: "bg-amber-100 text-amber-900",
};

function pick(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function RicercaPage(props: PageProps<"/ricerca">) {
  const params = await props.searchParams;
  const term = pick(params.q).trim().slice(0, 100);
  const product = pick(params.prodotto).trim().slice(0, 60);
  const area = parseArea(pick(params.area));
  const showRetail = pick(params.rivenditori) === "1";
  const searched = pick(params.cerca) === "1";

  const provider = getWebSearchProvider();

  let candidates: Candidate[] = [];
  let error: string | null = null;
  let queries: string[] = [];

  if (provider && searched) {
    queries = buildQueries({ term, product, area });
    const settled = await Promise.allSettled(queries.map((text) => provider.search({ text })));
    const results: WebSearchResult[] = settled.flatMap((s) => (s.status === "fulfilled" ? s.value : []));
    const failed = settled.filter((s): s is PromiseRejectedResult => s.status === "rejected");
    if (failed.length === settled.length) {
      error = failed[0].reason instanceof Error ? failed[0].reason.message : "Ricerca non riuscita.";
    }
    candidates = buildCandidates(results);
  }

  const supabase = await createClient();
  const { data: mine } = await supabase.from("suppliers").select("id, website");
  const existingByDomain = new Map<string, string>();
  for (const s of mine ?? []) {
    const d = s.website ? domainOf(s.website) : null;
    if (d) existingByDomain.set(d, s.id);
  }

  const hiddenRetail = candidates.filter((c) => c.likelihood === "rivenditore").length;
  const visible = (showRetail ? candidates : candidates.filter((c) => c.likelihood !== "rivenditore")).slice(0, MAX_SHOWN);

  return (
    <>
      <PageHeader
        title="Ricerca fornitori"
        description="Cerca sul web aziende di raccolta, selezione e ingrosso di abiti usati. I risultati sono suggerimenti da verificare."
      />

      {!provider && (
        <div className="mb-6 max-w-3xl rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-medium">La ricerca web non è ancora collegata.</p>
          <p className="mt-1">
            Serve una chiave di un servizio di ricerca (Brave Search o Tavily). Inseriscila in <code>.env.local</code> come{" "}
            <code>BRAVE_SEARCH_API_KEY</code> oppure <code>TAVILY_API_KEY</code> e riavvia l&apos;app. L&apos;app non mostra mai risultati
            inventati: finché la chiave manca, la ricerca resta spenta.
          </p>
        </div>
      )}

      <form method="get" className="mb-6 grid gap-3 rounded-lg border border-stone-200 bg-white p-4 sm:grid-cols-4">
        <input type="hidden" name="cerca" value="1" />
        <div className="sm:col-span-2">
          <label htmlFor="q" className="block text-xs font-medium text-stone-600">Cosa cerchi</label>
          <input id="q" name="q" defaultValue={term} placeholder="Es. box originali, stock sportswear" className={inputClass} />
        </div>
        <div>
          <label htmlFor="prodotto" className="block text-xs font-medium text-stone-600">Tipo di prodotto</label>
          <input id="prodotto" name="prodotto" defaultValue={product} placeholder="jeans, maglie, felpe…" className={inputClass} />
        </div>
        <div>
          <label htmlFor="area" className="block text-xs font-medium text-stone-600">Dove</label>
          <select id="area" name="area" defaultValue={area} className={inputClass}>
            {AREAS.map((a) => (
              <option key={a} value={a}>{AREA_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-4 sm:col-span-4">
          <button
            type="submit"
            disabled={!provider}
            className="rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
          >
            Cerca
          </button>
          <label className="flex items-center gap-2 text-sm text-stone-700">
            <input type="checkbox" name="rivenditori" value="1" defaultChecked={showRetail} />
            Mostra anche i probabili rivenditori
          </label>
        </div>
      </form>

      {error && <p role="alert" className="mb-4 text-sm text-red-700">{error}</p>}

      {provider && searched && !error && (
        <>
          <p className="mb-3 text-sm text-stone-600">
            {visible.length} risultati da {provider.name} ({queries.length} ricerche).
            {!showRetail && hiddenRetail > 0 && ` ${hiddenRetail} probabili rivenditori nascosti.`}
          </p>

          {visible.length === 0 ? (
            <div className="rounded-lg border border-dashed border-stone-300 bg-white p-8 text-center text-sm text-stone-700">
              Nessun risultato utile. Prova altre parole, un altro Paese o mostra anche i rivenditori.
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((c) => {
                const existingId = existingByDomain.get(c.domain);
                return (
                  <li key={c.domain} className="rounded-lg border border-stone-200 bg-white p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium text-stone-900">{c.name}</p>
                        <p className="text-xs text-stone-500">
                          <ExternalLink href={c.url}>{c.domain}</ExternalLink>
                          {c.country && ` · ${c.country} (dedotto dal dominio)`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[c.likelihood]}`}>
                        {LIKELIHOOD_LABELS[c.likelihood]}
                      </span>
                    </div>
                    {c.snippet && <p className="mt-2 text-sm text-stone-700">{c.snippet}</p>}
                    <ul className="mt-2 list-disc pl-5 text-xs text-stone-500">
                      {c.reasons.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      {existingId ? (
                        <p className="text-sm text-stone-600">
                          Già nei tuoi fornitori:{" "}
                          <Link href={`/fornitori/${existingId}`} className="font-medium text-stone-900 underline">apri la scheda</Link>
                        </p>
                      ) : (
                        <ActionForm action={addFromSearch} submitLabel="Aggiungi ai fornitori" successMessage="Aggiunto: lo trovi in Supplier Finder." variant="quiet">
                          <input type="hidden" name="name" value={c.name} />
                          <input type="hidden" name="website" value={c.rootUrl} />
                          <input type="hidden" name="country" value={c.country ?? ""} />
                          <input type="hidden" name="source_title" value={c.title} />
                          <input type="hidden" name="source_url" value={c.url} />
                          <input type="hidden" name="snippet" value={c.snippet.slice(0, 300)} />
                        </ActionForm>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          <p className="mt-4 max-w-3xl text-xs text-stone-500">
            Il giudizio si basa solo sulle parole del risultato: è un indizio, non una prova. Un fornitore aggiunto parte sempre come
            «origine non verificata»; per promuoverlo serve una fonte che documenti la provenienza (scheda fornitore → Informazioni e fonti).
          </p>
        </>
      )}
    </>
  );
}
