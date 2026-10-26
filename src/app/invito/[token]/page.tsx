import { Logo } from "@/components/Logo";
import Link from "next/link";
import { redirect } from "next/navigation";
import { isInviteToken } from "@/lib/team/invites";
import { getMembership } from "@/lib/team/membership";
import { createClient } from "@/lib/supabase/server";
import { AcceptForm } from "./AcceptForm";

export const metadata = { title: "Invito · ARCHVNT", referrer: "no-referrer" };

/** Fuori dal gruppo (app): chi non ha ancora un'attività deve poter vedere questa pagina. Il proxy richiede comunque il login. */
export default async function InvitoPage(props: PageProps<"/invito/[token]">) {
  const { token } = await props.params;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) redirect(`/login?next=${encodeURIComponent(`/invito/${token}`)}`);

  const membership = await getMembership();

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-sm rounded-lg border border-stone-200 bg-white p-6">
        <div className="mb-4"><Logo width={140} /></div>
        <h1 className="mb-4 text-xl font-semibold text-stone-900">Invito all&apos;attività</h1>

        {membership ? (
          <div className="space-y-3 text-sm text-stone-700">
            <p>
              Fai già parte di «{membership.businessName}» con l&apos;account {membership.email}.
            </p>
            <Link href="/dashboard" className="font-medium text-stone-900 underline">
              Vai alla dashboard
            </Link>
          </div>
        ) : !isInviteToken(token) ? (
          <p className="text-sm text-red-700">Invito non valido, scaduto o riservato a un&apos;altra email.</p>
        ) : (
          <div className="space-y-4 text-sm text-stone-700">
            <p>
              Stai accedendo come <strong>{data.user.email}</strong>. L&apos;invito funziona solo se è stato creato per
              questa stessa email.
            </p>
            <AcceptForm token={token} />
          </div>
        )}
      </div>
    </main>
  );
}
