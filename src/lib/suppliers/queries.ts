import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SUPPLIER_TYPES } from "./constants";
import { computeScore, type ScoreResult } from "./score";
import type {
  ContactLogEntry,
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
  contacts: ContactLogEntry[];
  score: ScoreResult | null;
}

export async function getSupplierDetail(id: string): Promise<SupplierDetail | null> {
  const supabase = await createClient();

  const [supplierRes, sourcesRes, claimsRes, evalsRes, contactsRes] = await Promise.all([
    supabase.from("suppliers").select("*").eq("id", id).maybeSingle(),
    supabase.from("supplier_sources").select("*").eq("supplier_id", id).order("created_at"),
    supabase.from("supplier_claims").select("*").eq("supplier_id", id).order("created_at"),
    supabase
      .from("supplier_evaluations")
      .select("*")
      .eq("supplier_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("contact_log")
      .select("id, supplier_id, contacted_at, channel, summary")
      .eq("supplier_id", id)
      .order("contacted_at", { ascending: false })
      .order("created_at", { ascending: false }),
  ]);

  if (supplierRes.error || sourcesRes.error || claimsRes.error || evalsRes.error || contactsRes.error) {
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
    contacts: (contactsRes.data ?? []) as ContactLogEntry[],
    score: evaluations[0] ? computeScore(evaluations[0], supplier.supplier_type) : null,
  };
}

export interface CrmRow {
  id: string;
  name: string;
  country: string | null;
  contact_status: Supplier["contact_status"];
  next_action: string | null;
  next_action_date: string | null;
  is_demo: boolean;
  lastContactAt: string | null;
  contactCount: number;
}

/** Fornitori con i dati utili al CRM (ultimo contatto, prossima azione). */
export async function listCrmRows(): Promise<CrmRow[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, name, country, contact_status, next_action, next_action_date, is_demo, contact_log(contacted_at)")
    .order("name", { ascending: true });
  if (error) throw new Error("Impossibile caricare il CRM");

  return (data ?? []).map((row) => {
    const { contact_log, ...rest } = row as Omit<CrmRow, "lastContactAt" | "contactCount"> & {
      contact_log: { contacted_at: string }[];
    };
    const dates = contact_log.map((c) => c.contacted_at).sort();
    return { ...rest, lastContactAt: dates.at(-1) ?? null, contactCount: dates.length };
  });
}
