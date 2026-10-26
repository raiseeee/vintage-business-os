import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

/** L'utente verificato dal server di autenticazione: una sola chiamata per richiesta, condivisa da layout e pagine. */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});
