import { signOut } from "./actions";
import { createFirstBusiness } from "./actions";

/** Schermata per un account che non fa ancora parte di nessuna attività. */
export function NoBusiness({ email }: { email: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <div className="w-full max-w-md space-y-5 rounded-lg border border-stone-200 bg-white p-6 text-sm text-stone-700">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-stone-400">Vintage</p>
          <h1 className="text-xl font-semibold text-stone-900">Non sei ancora membro di un&apos;attività</h1>
        </div>
        <p>
          Hai effettuato l&apos;accesso come <strong>{email}</strong>, ma questo account non è collegato a nessuna
          attività. Chiedi a un titolare di invitarti dalla pagina «Collaboratori» e apri il link che ti manda
          (accedendo con questa stessa email).
        </p>
        <form action={createFirstBusiness} className="border-t border-stone-100 pt-4">
          <p className="mb-2 text-xs text-stone-500">
            Solo per una installazione nuova e vuota: crea la prima attività. Se ne esiste già una, l&apos;operazione viene rifiutata.
          </p>
          <button type="submit" className="rounded-md border border-stone-300 px-3 py-1.5 text-sm font-medium hover:bg-stone-100">
            Crea la prima attività
          </button>
        </form>
        <form action={signOut}>
          <button type="submit" className="font-medium text-stone-700 underline">
            Esci
          </button>
        </form>
      </div>
    </main>
  );
}
