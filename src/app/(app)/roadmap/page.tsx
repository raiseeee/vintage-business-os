import { PageHeader } from "@/components/PagePlaceholder";

const milestones = [
  { name: "Milestone 1", desc: "Progetto avviabile, layout, navigazione, dashboard, logica margini testata", status: "Completata" },
  { name: "Milestone 2", desc: "Supabase: migrazioni SQL, RLS per utente, autenticazione", status: "Completata" },
  { name: "Milestone 3", desc: "Supplier Finder: anagrafica, fonti, punteggio trasparente", status: "Completata" },
  { name: "Milestone 4", desc: "Lotti e capi: inventario, vendite, profitti, CSV", status: "Da fare" },
  { name: "Milestone 5", desc: "CRM fornitori: stati, note, prossime azioni, valutazioni", status: "Da fare" },
];

const future = [
  "Collegamento a una casella email",
  "Visualizzazione e organizzazione in app delle email dei fornitori",
  "Invio di email personalizzate a più destinatari, con controlli anti-spam e rispetto delle regole applicabili",
  "Ricerche pianificate e notifiche",
  "Integrazione con un'API di ricerca web",
  "Sito pubblico, multiutenza e abbonamenti",
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
