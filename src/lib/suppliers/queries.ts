import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SUPPLIER_TYPES } from "./constants";
import { computeScore, type ScoreResult } from "./score";
import type {
  Supplier,
  SupplierClaim,
  SupplierEvaluation,
  SupplierFilters,
  SupplierSource,
} from "./types";

export interface SupplierListItem extends Supplier {
  score: ScoreResult | null;
}

/** Elenca i fornitori dell'utente (l'RLS filtra per utente) con i filtri richiesti. */
export async function listSuppliers(
  filters: SupplierFilters,
): Promise<SupplierListItem[]> {
  const supabase = await createClient();

  let query = supabase
    .from("suppliers")
    .select(
      "*, supplier_evaluations(proximity, transparency, min_order, budget_fit, vintage_interest, created_at)",
    )
    .order("name", { ascending: true });

  const q = filters.q?.trim();
  if (q) {
    // Escape dei caratteri speciali di LIKE, per cercare il testo letterale.
    const escaped = q.replace(/[\\%_]/g, (c) => `\\${c}`);
    query = query.ilike("name", `%${escaped}%`);
  }
  if (filters.country?.trim()) query = query.eq("country", filters.country.trim().toUpperCase());
  if (filters.language?.trim()) query = query.contains("languages", [filters.language.trim().toLowerCase()]);
  if (filters.stock?.trim()) query = query.contains("stock_types", [filters.stock.trim().toLowerCase()]);
  if (filters.brand?.trim()) query = query.contains("brands", [filters.brand.trim().toLowerCase()]);
  if (filters.type && (SUPPLIER_TYPES as readonly string[]).includes(filters.type)) {
    query = query.eq("supplier_type", filters.type);
  }

  const { data, error } = await query;
  if (error) throw new Error("Impossibile caricare i fornitori");

  return (data ?? []).map((row) => {
    const { supplier_evaluations, ...supplier } = row as Supplier & {
      supplier_evaluations: (SupplierEvaluation & { created_at: string })[];
    };
    const latest = [...(supplier_evaluations ?? [])].sort((a, b) =>
      b.created_at.localeCompare(a.created_at),
    )[0];
    return {
      ...supplier,
      score: latest ? computeScore(latest, supplier.supplier_type) : null,
    };
  });
}

/** True se esistono dati demo per l'utente. */
export async function hasDemoData(): Promise<boolean> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("suppliers")
    .select("id", { count: "exact", head: true })
    .eq("is_demo", true);
  if (error) throw new Error("Impossibile verificare i dati demo");
  return (count ?? 0) > 0;
}

export interface SupplierDetail {
  supplier: Supplier;
  sources: SupplierSource[];
  claims: SupplierClaim[];
  evaluations: SupplierEvaluation[];
  score: ScoreResult | null;
}

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
  const supabase = await createClient();

  const [supplierRes, sourcesRes, claimsRes, evalsRes] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).maybeSingle(),
    supabase.from("supplier_sources").select("*").eq("supplier_id", id).order("created_at"),
    supabase.from("supplier_claims").select("*").eq("supplier_id", id).order("created_at"),
    supabase
      .from("supplier_evaluations")
      .select("*")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (supplierRes.error || sourcesRes.error || claimsRes.error || evalsRes.error) {
    throw new Error("Impossibile caricare il fornitore");
  }
  if (!supplierRes.data) return null;

  const supplier = supplierRes.data as Supplier;
  const evaluations = (evalsRes.data ?? []) as SupplierEvaluation[];

  return {
    supplier,
    sources: (sourcesRes.data ?? []) as SupplierSource[],
    claims: (claimsRes.data ?? []) as SupplierClaim[],
    evaluations,
    score: evaluations[0] ? computeScore(evaluations[0], supplier.supplier_type) : null,
  };
}
