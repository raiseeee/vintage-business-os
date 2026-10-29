/** Mostrato subito mentre la pagina carica i dati: la navigazione risponde al clic senza attendere. */
export default function Loading() {
  return (
    <div aria-busy="true" aria-label="Caricamento" className="animate-pulse">
      <div className="mb-8 border-b border-stone-300 pb-6">
        <div className="h-8 w-56 rounded-md bg-stone-200" />
        <div className="mt-4 h-4 w-80 max-w-full rounded bg-stone-200" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 rounded-lg bg-stone-200/70" />
        ))}
      </div>
      <div className="mt-6 h-56 rounded-lg bg-stone-200/70" />
    </div>
  );
}
