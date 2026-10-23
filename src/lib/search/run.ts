import type { WebSearchProvider, WebSearchResult } from "./types";

export interface RunOutcome {
  results: WebSearchResult[];
  failed: number;
  firstError: string | null;
}

/** Esegue le query a gruppi (per non superare i limiti del servizio). Un errore non ferma le altre. */
export async function runSearches(
  provider: WebSearchProvider,
  queries: string[],
  concurrency = 4,
): Promise<RunOutcome> {
  const results: WebSearchResult[] = [];
  let failed = 0;
  let firstError: string | null = null;

  for (let i = 0; i < queries.length; i += concurrency) {
    const batch = queries.slice(i, i + concurrency);
    const settled = await Promise.allSettled(batch.map((text) => provider.search({ text })));
    for (const s of settled) {
      if (s.status === "fulfilled") results.push(...s.value);
      else {
        failed++;
        firstError ??= s.reason instanceof Error ? s.reason.message : "Ricerca non riuscita.";
      }
    }
  }
  return { results, failed, firstError };
}
