import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseEnv } from "@/lib/env";

/**
 * Rinnova la sessione Supabase a ogni richiesta e dice se l'utente è autenticato.
 * Usa getClaims(): verifica la firma del token, a differenza di getSession()
 * che si fida del cookie senza controllarlo.
 */
export async function updateSession(request: NextRequest, env: SupabaseEnv) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data } = await supabase.auth.getClaims();

  return {
    isAuthenticated: Boolean(data?.claims),
    /** Risposta che contiene gli eventuali cookie di sessione aggiornati. */
    getResponse: () => response,
  };
}
