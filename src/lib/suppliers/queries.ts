import "server-only";
import { createClient } from "@/lib/supabase/server";

export interface SupplierRow {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
}

const COLUMNS = "id, name, email, phone, address, notes";

/** Elenco dei fornitori. `available: false` finché non si applica la migrazione dei fornitori. */
export async function getSuppliers(): Promise<{ rows: SupplierRow[]; available: boolean }> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select(COLUMNS).order("name").limit(2000);
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") return { rows: [], available: false };
    throw new Error("Impossibile leggere i fornitori");
  }
  return { rows: (data ?? []) as SupplierRow[], available: true };
}

export async function getSupplier(id: string): Promise<SupplierRow | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("suppliers").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) return null;
  return (data as SupplierRow | null) ?? null;
}
