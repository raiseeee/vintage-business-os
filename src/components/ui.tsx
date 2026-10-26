import type { ReactNode } from "react";
import { ITEM_STATUS_LABELS } from "@/lib/business/constants";

export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-stone-300/70 bg-white p-5">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">
      {children}
    </span>
  );
}

/** Restituisce l'URL solo se è http(s): non si crea mai un link con altri schemi. */
export function safeHref(url: string | null | undefined): string | null {
  return url && /^https?:\/\//i.test(url) ? url : null;
}

export function ExternalLink({ href, children }: { href: string | null | undefined; children: ReactNode }) {
  const safe = safeHref(href);
  if (!safe) return <>{children}</>;
  return (
    <a
      href={safe}
      target="_blank"
      rel="noopener noreferrer"
      className="text-blue-800 underline underline-offset-2 hover:text-blue-950"
    >
      {children}
    </a>
  );
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("it-IT");
}

const ITEM_STATUS_STYLES: Record<string, string> = {
  da_controllare: "bg-stone-200 text-stone-800",
  da_fotografare: "bg-amber-100 text-amber-900",
  pronto: "bg-sky-100 text-sky-900",
  pubblicato: "bg-indigo-100 text-indigo-900",
  venduto: "bg-green-100 text-green-900",
  reso: "bg-red-100 text-red-900",
};

export function ItemStatusBadge({ status }: { status: keyof typeof ITEM_STATUS_LABELS }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${ITEM_STATUS_STYLES[status]}`}>
      {ITEM_STATUS_LABELS[status]}
    </span>
  );
}

/** Riquadro con un numero: usato per i riepiloghi economici. */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "neutral" | "good" | "bad";
}) {
  const color = { neutral: "text-stone-900", good: "text-green-800", bad: "text-red-800" }[tone];
  return (
    <div className="stat-card relative overflow-hidden rounded-lg border border-stone-300/70 bg-white p-4 pl-6 before:absolute before:left-2 before:top-4 before:size-2 before:rounded-full before:bg-background before:shadow-[inset_0_0_0_1px_var(--color-stone-300)]">
      <p className="text-sm text-stone-500">{label}</p>
      <p className={`mt-1 font-display text-3xl font-semibold tabular-nums tracking-tight ${color}`}>{value}</p>
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}

/** Tono di un importo con segno: verde se positivo, rosso se negativo, neutro se zero. */
export function toneOf(cents: number): "neutral" | "good" | "bad" {
  return cents > 0 ? "good" : cents < 0 ? "bad" : "neutral";
}
