"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { domainOf } from "@/lib/search/classify";
import { dbErrorMessage, fail, parseForm as parse, success, type FormState } from "@/lib/form-action";
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

  revalidatePath("/ricerca");
  revalidatePath("/fornitori");
  revalidatePath("/crm");
  return success;
}
