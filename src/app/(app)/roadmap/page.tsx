import { PageHeader } from "@/components/PagePlaceholder";

const milestones = [
  { name: "Milestone 1", desc: "Progetto avviabile, layout, navigazione, dashboard, logica margini testata", status: "Completata" },
  { name: "Milestone 2", desc: "Supabase: migrazioni SQL, RLS per utente, autenticazione", status: "Completata" },
  { name: "Milestone 3", desc: "Lotti e capi: stati, foto, vendite, profitti, CSV", status: "Completata" },
  { name: "Milestone 4", desc: "Statistiche per lotto, calcolatore, inventario dei materiali", status: "Completata" },
  { name: "Milestone 5", desc: "Attività condivisa: soci titolari e collaboratori", status: "Completata" },
];

const future = [
  "Collegamento ai siti di vendita (Vinted, Depop, eBay…) per preparare gli annunci dai capi pronti: titolo, descrizione, prezzo e foto. Per quanto ne so, Vinted e Depop non offrono un'API pubblica ai venditori, quindi all'inizio sarebbe un annuncio da copiare e incollare; la pubblicazione automatica è da verificare sito per sito",
  "Sito pubblico e abbonamenti (la condivisione tra i soci con ruoli è già fatta: pagina Collaboratori)",
];

export default function RoadmapPage() {
  return (
    <>
      <PageHeader
        title="Roadmap"
        description="Cosa è in sviluppo e cosa è stato volutamente rimandato."
      />

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Milestone MVP</h2>
      <ul className="mb-8 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {milestones.map((m) => (
          <li key={m.name} className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-stone-900">{m.name}</p>
              <p className="text-sm text-stone-600">{m.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">{m.status}</span>
          </li>
        ))}
      </ul>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Funzioni future (non implementate)</h2>
      <ul className="list-disc space-y-1 rounded-lg border border-stone-200 bg-white py-4 pl-9 pr-5 text-sm text-stone-600">
        {future.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </>
  );
}
