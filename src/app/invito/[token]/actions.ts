"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isInviteToken } from "@/lib/team/invites";
import { isMissingFunction } from "@/lib/team/membership";

export type AcceptState = { error: string | null };

export async function acceptInvite(token: string): Promise<AcceptState> {
  if (!isInviteToken(token)) return { error: "Invito non valido, scaduto o riservato a un'altra email." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_invite", { p_token: token });
  if (error) {
    if (isMissingFunction(error)) return { error: "L'app non è ancora pronta per gli inviti (migrazione mancante)." };
    // Un solo messaggio per ogni motivo di rifiuto: non si deve capire se il codice esiste.
    if (error.code === "23505") return { error: "Fai già parte di un'attività." };
    return { error: "Invito non valido, scaduto o riservato a un'altra email." };
  }

  redirect("/dashboard");
}
