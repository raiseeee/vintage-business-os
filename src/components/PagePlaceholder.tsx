import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  /** Pulsanti della pagina: sempre in alto a destra, sulla riga del titolo. */
  actions?: ReactNode;
}) {
  return (
    <header className="mb-7 border-b border-stone-300 pb-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <h1 className="min-w-0 text-3xl font-semibold leading-tight text-stone-900 md:text-4xl">{title}</h1>
        {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
      </div>
      <p className="mt-2 max-w-xl text-sm text-stone-600">{description}</p>
    </header>
  );
}

export function PlaceholderCard({
  milestone,
  items,
}: {
  milestone: string;
  items: string[];
}) {
  return (
    <section className="rounded-lg border border-dashed border-stone-300 bg-white p-6">
      <p className="text-sm font-medium text-stone-900">
        Non ancora implementato — previsto in {milestone}
      </p>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600">
        {items.map((i) => (
          <li key={i}>{i}</li>
        ))}
      </ul>
    </section>
  );
}
