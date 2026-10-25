import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type Role = "owner" | "collaborator";

export type Membership = {
  userId: string;
  email: string;
  businessId: string;
  businessName: string;
  role: Role;
  /** true finché la migrazione «attività condivisa» non è stata applicata al database. */
  legacy: boolean;
};

/**
 * Chi è l'utente e a quale attività appartiene. Una sola chiamata per richiesta.
 * - null: non loggato oppure loggato ma non ancora membro di un'attività (serve un invito).
 * - Se il database è ancora quello a utente singolo (funzione my_membership assente),
 *   l'utente è titolare della propria attività, così l'app funziona anche prima della migrazione.
 */
export const getMembership = cache(async (): Promise<Membership | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;
  if (!user) return null;

  const { data, error } = await supabase.rpc("my_membership");
  if (error) {
    if (isMissingFunction(error)) {
      return {
        userId: user.id,
        email: user.email ?? "",
        businessId: user.id,
        businessName: "Vintage Business",
        role: "owner",
        legacy: true,
      };
    }
    throw new Error("Impossibile leggere l'appartenenza all'attività");
  }

  const row = Array.isArray(data) ? data[0] : null;
  if (!row) return null;
  return {
    userId: user.id,
    email: user.email ?? "",
    businessId: row.business_id as string,
    businessName: row.business_name as string,
    role: row.role as Role,
    legacy: false,
  };
});

/** PostgREST risponde PGRST202 (o 404) quando la funzione non esiste. */
export function isMissingFunction(error: { code?: string; message?: string }): boolean {
  return error.code === "PGRST202" || error.code === "42883" || /could not find the function/i.test(error.message ?? "");
}

export const OWNER_ONLY_MESSAGE = "Solo un titolare può eliminare o annullare. Chiedilo a uno dei soci.";

/** Per le azioni che eliminano: true se l'utente è titolare. Il database applica comunque lo stesso limite. */
export async function isOwner(): Promise<boolean> {
  const m = await getMembership();
  return m?.role === "owner";
}
