"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { buildCandidates, domainOf } from "@/lib/search/classify";
import { getWebSearchProvider } from "@/lib/search/provider";
import { buildQueries, parseArea, parseDepth, parseTypes } from "@/lib/search/queries";
import { runSearches } from "@/lib/search/run";
import { dbErrorMessage, fail, parseForm as parse, success, validId, type FormState } from "@/lib/form-action";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";
import { optionalText, optionalUrl } from "@/lib/validation";

const addSchema = z.object({
  name: z.string().trim().min(1, "Nome mancante").max(200),
  website: optionalUrl.refine((v) => v !== null, "Sito mancante"),
  country: z
    .string()
    .trim()
    .transform((s) => (/^[A-Za-z]{2}$/.test(s) ? s.toUpperCase() : null)),
  source_title: z.string().trim().min(1).max(200),
  source_url: optionalUrl,
  snippet: optionalText,
});

/**
 * Aggiunge un risultato di ricerca ai fornitori, SEMPRE come «origine non verificata».
 * La pagina trovata è registrata come fonte con una nota che dice che non è ancora verificata:
 * nessuna affermazione viene salvata come «documentata».
 */
export async function addFromSearch(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = parse(addSchema, formData);
  if (!parsed.ok) return fail(parsed.error);
  const d = parsed.data;

  const supabase = await createClient();
  const domain = domainOf(d.website!);

  const { data: existing, error: listError } = await supabase.from("suppliers").select("id, website");
  if (listError) return fail(dbErrorMessage(listError));
  if (domain && (existing ?? []).some((s) => s.website && domainOf(s.website) === domain)) {
    return fail("Questo sito è già tra i tuoi fornitori.");
  }

  const { data: supplier, error } = await supabase
    .from("suppliers")
    .insert({
      name: d.name,
      website: d.website,
      country: d.country,
      supplier_type: "origine_non_verificata",
      contact_status: "da_contattare",
      notes: "Trovato con la ricerca web: provenienza della merce da verificare.",
    })
    .select("id")
    .single();
  if (error || !supplier) return fail(error ? dbErrorMessage(error) : "Operazione non riuscita. Riprova.");

  const { error: sourceError } = await supabase.from("supplier_sources").insert({
    supplier_id: supplier.id,
    title: d.source_title,
    url: d.source_url ?? d.website,
    retrieved_at: todayIso(),
    note: `Risultato di ricerca, non ancora verificato.${d.snippet ? ` Estratto: ${d.snippet}` : ""}`,
  });
  if (sourceError) {
    await supabase.from("suppliers").delete().eq("id", supplier.id);
    return fail(dbErrorMessage(sourceError));
  }

  revalidatePath("/ricerca", "layout");
  revalidatePath("/fornitori");
  revalidatePath("/crm");
  return success;
}

/**
 * Lancia la ricerca, salva la ricerca e i risultati nel database e apre la pagina dei risultati.
 * Senza chiave del servizio non fa nulla (nessun risultato inventato).
 */
export async function runSearch(_prev: FormState, formData: FormData): Promise<FormState> {
  const provider = getWebSearchProvider();
  if (!provider) return fail("La ricerca non è collegata: manca la chiave del servizio in .env.local.", formData);

  const term = String(formData.get("q") ?? "").trim().slice(0, 100);
  const product = String(formData.get("prodotto") ?? "").trim().slice(0, 60);
  const area = parseArea(String(formData.get("area") ?? ""));
  const depth = parseDepth(String(formData.get("profondita") ?? ""));
  const types = parseTypes(formData.getAll("tipo").map(String));

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return fail("Sessione scaduta: accedi di nuovo.", formData);

  const queries = buildQueries({ term, product, area, types, depth });
  const outcome = await runSearches(provider, queries);
  if (outcome.failed === queries.length) {
    return fail(outcome.firstError ?? "Ricerca non riuscita. Riprova.", formData);
  }

  const candidates = buildCandidates(outcome.results);

  const { data: run, error } = await supabase
    .from("search_runs")
    .insert({
      term,
      product,
      area,
      box_types: types,
      depth,
      provider: provider.name,
      queries,
      queries_failed: outcome.failed,
      result_count: candidates.length,
    })
    .select("id")
    .single();
  if (error || !run) return fail(error ? dbErrorMessage(error) : "Operazione non riuscita. Riprova.", formData);

  if (candidates.length > 0) {
    const { error: resultsError } = await supabase.from("search_results").insert(
      candidates.map((c) => ({
        run_id: run.id,
        domain: c.domain,
        name: c.name,
        url: c.url,
        root_url: c.rootUrl,
        country: c.country,
        title: c.title,
        snippet: c.snippet,
        likelihood: c.likelihood,
        reasons: c.reasons,
        score: c.score,
      })),
    );
    if (resultsError) {
      await supabase.from("search_runs").delete().eq("id", run.id);
      return fail(dbErrorMessage(resultsError), formData);
    }
  }

  revalidatePath("/ricerca");
  revalidatePath("/ricerca/storico");
  redirect(`/ricerca/${run.id}`);
}

export async function deleteRun(runId: string): Promise<FormState> {
  if (!validId(runId)) return fail("Ricerca non valida");
  const supabase = await createClient();
  const { error } = await supabase.from("search_runs").delete().eq("id", runId);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/ricerca");
  revalidatePath("/ricerca/storico");
  return success;
}
