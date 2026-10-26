import "server-only";
import { createClient } from "@supabase/supabase-js";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Client con la chiave di servizio (service_role): ignora le policy RLS.
 * Solo lato server, solo per creare/rimuovere account. La chiave sta nella variabile
 * SUPABASE_SERVICE_ROLE_KEY (mai con prefisso NEXT_PUBLIC_, mai nel repository).
 * Chi lo usa deve prima verificare che chi chiama sia titolare.
 */
export function createAdminClient() {
  const env = getSupabaseEnv();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!env || !key) return null;
  return createClient(env.url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
