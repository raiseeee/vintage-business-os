import "server-only";
import { parseBraveResults, parseTavilyResults } from "./parse";
import type { WebSearchProvider, WebSearchQuery } from "./types";

export type { WebSearchProvider, WebSearchQuery, WebSearchResult } from "./types";

/**
 * Provider di ricerca web.
 *
 * Regole:
 *  - la chiave API vive solo in variabili d'ambiente server-side (mai NEXT_PUBLIC_);
 *  - i risultati sono SUGGERIMENTI da esaminare: diventano un fornitore solo quando
 *    l'utente preme «Aggiungi», sempre come «origine non verificata»;
 *  - nessun risultato simulato: senza chiave la pagina dice che la ricerca non è configurata.
 */

const TIMEOUT_MS = 12_000;

/** Siti che non sono mai fornitori: li escludiamo già a monte per non sprecare risultati. */
const TAVILY_EXCLUDED = [
  "shutterstock.com", "istockphoto.com", "gettyimages.com", "alamy.com", "freepik.com", "unsplash.com", "pexels.com",
  "pinterest.com", "ebay.com", "vinted.com", "etsy.com", "amazon.com", "facebook.com", "instagram.com", "tiktok.com", "youtube.com",
];

async function request(url: string, init: RequestInit, label: string): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    throw new Error(`${label}: servizio non raggiungibile o troppo lento.`);
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(`${label}: chiave API rifiutata. Controlla il valore in .env.local.`);
  }
  if (res.status === 429) {
    throw new Error(`${label}: limite di ricerche raggiunto. Riprova più tardi.`);
  }
  if (!res.ok) throw new Error(`${label}: errore ${res.status}.`);
  return res.json();
}

function brave(key: string): WebSearchProvider {
  return {
    name: "Brave Search",
    async search(query: WebSearchQuery) {
      const url = `https://api.search.brave.com/res/v1/web/search?${new URLSearchParams({
        q: query.text,
        count: "20",
        result_filter: "web",
      })}`;
      const json = await request(
        url,
        { headers: { Accept: "application/json", "X-Subscription-Token": key } },
        "Brave Search",
      );
      return parseBraveResults(json);
    },
  };
}

function tavily(key: string): WebSearchProvider {
  return {
    name: "Tavily",
    async search(query: WebSearchQuery) {
      const json = await request(
        "https://api.tavily.com/search",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ query: query.text, max_results: 20, search_depth: "basic", include_images: false, exclude_domains: TAVILY_EXCLUDED }),
        },
        "Tavily",
      );
      return parseTavilyResults(json);
    },
  };
}

/** Il provider configurato (Brave se c'è BRAVE_SEARCH_API_KEY, altrimenti Tavily), o null. */
export function getWebSearchProvider(): WebSearchProvider | null {
  const braveKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (braveKey) return brave(braveKey);
  const tavilyKey = process.env.TAVILY_API_KEY?.trim();
  if (tavilyKey) return tavily(tavilyKey);
  return null;
}
