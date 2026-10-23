import "server-only";
import { fetchAll } from "@/lib/business/paginate";
import { createClient } from "@/lib/supabase/server";
import { domainOf, type Likelihood } from "./classify";

export interface SearchRun {
  id: string;
  term: string;
  product: string;
  area: string;
  box_types: string[];
  depth: string;
  provider: string;
  queries: string[];
  queries_failed: number;
  result_count: number;
  created_at: string;
}

export interface SearchResultRow {
  id: string;
  run_id: string;
  domain: string;
  name: string;
  url: string;
  root_url: string;
  country: string | null;
  title: string;
  snippet: string;
  likelihood: Likelihood;
  reasons: string[];
  score: number;
  created_at: string;
}

export async function listRuns(limit?: number): Promise<SearchRun[]> {
  const supabase = await createClient();
  let q = supabase.from("search_runs").select("*").order("created_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw new Error("Impossibile caricare le ricerche");
  return (data ?? []) as SearchRun[];
}

export async function getRun(id: string): Promise<{ run: SearchRun; results: SearchResultRow[] } | null> {
  const supabase = await createClient();
  const { data: run, error } = await supabase.from("search_runs").select("*").eq("id", id).maybeSingle();
  if (error) throw new Error("Impossibile caricare la ricerca");
  if (!run) return null;
  const results = await fetchAll<SearchResultRow>((from, to) =>
    supabase.from("search_results").select("*").eq("run_id", id).order("score", { ascending: false }).order("id").range(from, to),
  );
  return { run: run as SearchRun, results };
}

export interface FoundCompany extends SearchResultRow {
  /** In quante ricerche è comparsa. */
  runs: number;
}

/** Tutte le aziende trovate in tutte le ricerche, una per dominio (la riga col punteggio migliore). */
export async function listAllCompanies(): Promise<FoundCompany[]> {
  const supabase = await createClient();
  const rows = await fetchAll<SearchResultRow>((from, to) =>
    supabase.from("search_results").select("*").order("created_at", { ascending: false }).order("id").range(from, to),
  );
  const byDomain = new Map<string, FoundCompany>();
  for (const r of rows) {
    const cur = byDomain.get(r.domain);
    if (!cur) byDomain.set(r.domain, { ...r, runs: 1 });
    else {
      cur.runs++;
      if (r.score > cur.score) Object.assign(cur, { ...r, runs: cur.runs });
    }
  }
  return [...byDomain.values()].sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
}

/** dominio → id del fornitore, per segnalare le aziende già aggiunte. */
export async function existingSuppliersByDomain(): Promise<Map<string, string>> {
  const supabase = await createClient();
  const { data } = await supabase.from("suppliers").select("id, website");
  const map = new Map<string, string>();
  for (const s of data ?? []) {
    const d = s.website ? domainOf(s.website) : null;
    if (d) map.set(d, s.id);
  }
  return map;
}
