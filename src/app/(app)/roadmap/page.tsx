import { PageHeader } from "@/components/PagePlaceholder";

const milestones = [
  { name: "Milestone 1", desc: "Progetto avviabile, layout, navigazione, dashboard, logica margini testata", status: "Completata" },
  { name: "Milestone 2", desc: "Supabase: migrazioni SQL, RLS per utente, autenticazione", status: "Completata" },
  { name: "Milestone 3", desc: "Supplier Finder: anagrafica, fonti, punteggio trasparente", status: "Completata" },
  { name: "Milestone 4", desc: "Lotti e capi: inventario, vendite, profitti, CSV", status: "Completata" },
  { name: "Milestone 5", desc: "CRM fornitori: stati, storico contatti, prossime azioni, valutazioni", status: "Completata" },
];

const future = [
  "Collegamento a una casella email",
  "Visualizzazione e organizzazione in app delle email dei fornitori",
  "Invio di email personalizzate a più destinatari, con controlli anti-spam e rispetto delle regole applicabili",
  "Ricerche pianificate e notifiche",
  "Integrazione con un'API di ricerca web",
  "Sito pubblico, multiutenza e abbonamenti",
];

const research = [
  { step: "Definire i criteri", desc: "Paese, tipo di stock, marchi, budget e ordine minimo che ti interessano.", status: "Da fare" },
  { step: "Cercare fornitori reali", desc: "Ricerca con fonti verificabili (sito, registro imprese, recensioni): nessun dato inventato.", status: "Da fare" },
  { step: "Valutare e scegliere", desc: "Controllare provenienza e prove, poi segnare i fornitori che ti sono piaciuti.", status: "Da fare" },
  { step: "Portarli nella pagina Fornitori", desc: "I fornitori scelti vengono salvati con le loro fonti nella pagina Fornitori.", status: "Da fare" },
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

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-stone-500">Ricerca fornitori</h2>
      <ul className="mb-8 divide-y divide-stone-200 rounded-lg border border-stone-200 bg-white">
        {research.map((r) => (
          <li key={r.step} className="flex items-start justify-between gap-4 px-5 py-4">
            <div>
              <p className="text-sm font-medium text-stone-900">{r.step}</p>
              <p className="text-sm text-stone-600">{r.desc}</p>
            </div>
            <span className="shrink-0 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">{r.status}</span>
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
