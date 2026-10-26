"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

/** Installazione nuova: l'utente crea la prima attività e ne diventa titolare. Il database rifiuta se ne esiste già una. */
export async function createFirstBusiness() {
  const supabase = await createClient();
  await supabase.rpc("create_business", { p_name: "ARCHVNT" });
  redirect("/dashboard");
}
