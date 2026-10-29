import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { getSupabaseEnv } from "@/lib/env";
import { getAuthUser } from "@/lib/supabase/user";
import { getMembership } from "@/lib/team/membership";
import { NoBusiness } from "./NoBusiness";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  // Seconda linea di difesa oltre al proxy: ogni pagina dell'app richiede un utente verificato.
  if (!getSupabaseEnv()) redirect("/login");

  const user = await getAuthUser();
  if (!user) redirect("/login");

  // Account valido ma senza attività: serve un invito (le tabelle restano comunque vuote per lui).
  const membership = await getMembership();
  if (!membership) return <NoBusiness email={user.email ?? ""} />;

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <Sidebar email={user.email ?? ""} isOwner={membership.role === "owner"} />
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 md:px-10 md:py-8">
        <div className="mx-auto w-full max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
