"use client";

import { createBrowserClient } from "@supabase/ssr";
import { getSupabaseEnv } from "@/lib/env";

/**
 * Client Supabase per il browser. Serve solo per caricare le foto direttamente nello
 * storage (evita i limiti di dimensione delle richieste verso il server).
 * Usa la sessione dell'utente: le policy dello storage lo limitano alla sua cartella.
 */
export function createClient() {
  const env = getSupabaseEnv();
  if (!env) throw new Error("Supabase non configurato");
  return createBrowserClient(env.url, env.publishableKey);
}
