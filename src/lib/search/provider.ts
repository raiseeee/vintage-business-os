/**
 * Punto di integrazione per una futura API di ricerca web (non implementata).
 *
 * Regole da rispettare quando verrà collegata:
 *  - la chiave API vive solo in variabili d'ambiente server-side (mai NEXT_PUBLIC_);
 *  - i risultati sono SUGGERIMENTI da esaminare: non vengono mai salvati come
 *    fornitori né come informazioni "documentate" in automatico;
 *  - un risultato diventa una fonte (supplier_sources) solo dopo che l'utente
 *    l'ha letto e confermato;
 *  - nessun risultato simulato: senza provider si mostra che la ricerca non è configurata.
 */

export interface WebSearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface WebSearchQuery {
  text: string;
  country?: string;
  language?: string;
}

export interface WebSearchProvider {
  readonly name: string;
  search(query: WebSearchQuery): Promise<WebSearchResult[]>;
}

/** Nessun provider è ancora configurato: restituisce sempre null. */
export function getWebSearchProvider(): WebSearchProvider | null {
  return null;
}
