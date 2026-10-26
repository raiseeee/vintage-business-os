import Link from "next/link";
import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  actions,
  badges,
  back,
}: {
  title: string;
  description: ReactNode;
  /** Pulsanti della pagina: sempre in alto a destra, sulla riga del titolo. */
  actions?: ReactNode;
  /** Etichette accanto al titolo (stato del capo, canale…). */
  badges?: ReactNode;
  /** Link per tornare alla pagina precedente, sopra il titolo. */
  back?: { href: string; label: string };
}) {
  return (
    <header className="mb-7 border-b border-stone-300 pb-5">
      {back && (
        <Link href={back.href} className="back-link mb-3 inline-flex items-center gap-1 text-sm text-stone-600 hover:text-stone-900">
          <span aria-hidden className="back-arrow">←</span> {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
          <h1 className="min-w-0 text-3xl font-semibold leading-tight text-stone-900 md:text-4xl">{title}</h1>
          {badges}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 pt-1">{actions}</div>}
      </div>
      <div className="mt-2 max-w-2xl text-sm text-stone-600">{description}</div>
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
