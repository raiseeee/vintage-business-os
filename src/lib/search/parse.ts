import type { WebSearchResult } from "./types";

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function clean(s: string): string {
  return s.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function toResults(list: unknown, snippetKey: string): WebSearchResult[] {
  if (!Array.isArray(list)) return [];
  const out: WebSearchResult[] = [];
  for (const r of list) {
    if (typeof r !== "object" || r === null) continue;
    const rec = r as Record<string, unknown>;
    const url = str(rec.url);
    if (!/^https?:\/\//i.test(url)) continue;
    out.push({ title: clean(str(rec.title)), url, snippet: clean(str(rec[snippetKey])).slice(0, 400) });
  }
  return out;
}

/** Risposta di Brave: { web: { results: [{ title, url, description }] } } */
export function parseBraveResults(json: unknown): WebSearchResult[] {
  const web = (json as { web?: { results?: unknown } } | null)?.web;
  return toResults(web?.results, "description");
}

/** Risposta di Tavily: { results: [{ title, url, content }] } */
export function parseTavilyResults(json: unknown): WebSearchResult[] {
  return toResults((json as { results?: unknown } | null)?.results, "content");
}
