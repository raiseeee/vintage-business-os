import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv } from "@/lib/env";
import { updateSession } from "@/lib/supabase/session";
import { safeNextPath } from "@/lib/team/next-path";

const LOGIN_PATH = "/login";

function redirectTo(request: NextRequest, path: string, from?: NextResponse) {
  const response = NextResponse.redirect(new URL(path, request.url));
  // Mantiene i cookie di sessione eventualmente aggiornati.
  from?.cookies.getAll().forEach((c) => response.cookies.set(c));
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isLogin = pathname === LOGIN_PATH;

  const env = getSupabaseEnv();
  if (!env) {
    // Senza configurazione nessuna pagina di dati è raggiungibile:
    // la pagina di login mostra le istruzioni.
    return isLogin ? NextResponse.next() : redirectTo(request, LOGIN_PATH);
  }

  const { isAuthenticated, getResponse } = await updateSession(request, env);
  const response = getResponse();

  if (!isAuthenticated && !isLogin) {
    // Si ricorda dove voleva andare (es. un link d'invito) per tornarci dopo l'accesso.
    const target = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return redirectTo(request, LOGIN_PATH + target, response);
  }
  if (isAuthenticated && isLogin) {
    return redirectTo(request, safeNextPath(request.nextUrl.searchParams.get("next")), response);
  }
  return response;
}

export const config = {
  // Tutte le rotte tranne file statici e immagini ottimizzate.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
