import { getSupabaseEnv } from "@/lib/env";
import { safeNextPath } from "@/lib/team/next-path";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Accedi · Vintage Business OS" };

export default async function LoginPage(props: PageProps<"/login">) {
  const { next } = await props.searchParams;
  const configured = getSupabaseEnv() !== null;

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Vintage</p>
        <h1 className="mb-6 text-xl font-semibold text-stone-900">Business OS</h1>

        {configured ? (
          <LoginForm next={typeof next === "string" ? safeNextPath(next, "") || undefined : undefined} />
        ) : (
          <div className="space-y-2 text-sm text-stone-700">
            <p className="font-medium text-amber-900">Supabase non è ancora configurato.</p>
            <p>
              Copia <code className="rounded bg-stone-100 px-1">.env.example</code> in{" "}
              <code className="rounded bg-stone-100 px-1">.env.local</code>, inserisci URL e
              publishable key del tuo progetto Supabase e riavvia il server. I passaggi
              completi sono nel README.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
