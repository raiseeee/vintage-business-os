import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import type { ReactNode } from "react";
import { compare } from "@/lib/business/monthly";
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
    <section className="rounded-lg border border-stone-300 bg-white p-6">
      <h2 className="text-lg font-semibold text-stone-900">{title}</h2>
      {description && <p className="mt-2 text-sm text-stone-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full bg-stone-100 px-2 py-0 text-xs leading-6 text-stone-700">
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
      className="text-stone-900 underline underline-offset-2 hover:text-stone-600"
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
  da_controllare: "bg-stone-100 text-stone-600",
  da_fotografare: "bg-stone-100 text-stone-800",
  pronto: "bg-stone-200 text-stone-900",
  pubblicato: "border border-stone-400 text-stone-900",
  venduto: "bg-stone-900 text-white",
  reso: "border border-stone-300 text-stone-600",
};

export function ItemStatusBadge({ status }: { status: keyof typeof ITEM_STATUS_LABELS }) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2 py-0 text-xs font-semibold leading-6 ${ITEM_STATUS_STYLES[status]}`}>
      {ITEM_STATUS_LABELS[status]}
    </span>
  );
}

/** Variazione rispetto al mese precedente: simbolo a linea, segno e percentuale, senza colori. */
export function Delta({
  current,
  previous,
  previousLabel,
  format,
}: {
  current: number;
  previous: number;
  /** Nome del mese di confronto, già in minuscolo («settembre»). */
  previousLabel: string;
  format: (value: number) => string;
}) {
  const { diff, percent } = compare(current, previous);
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : Minus;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const amount = percent === null ? format(Math.abs(diff)) : `${Math.abs(percent)}%`;
  return (
    <p className="mt-2 flex items-center gap-2 text-sm text-stone-600">
      <Icon aria-hidden className="size-4 shrink-0" strokeWidth={1.5} />
      <span>
        <span className="font-semibold text-stone-900">{diff === 0 ? "Invariato" : `${sign}${amount}`}</span>
        {" "}
        rispetto a {previousLabel} ({format(previous)})
      </span>
    </p>
  );
}

/** Un numero senza cornici né sfondi. Con `delta` mostra il confronto con il mese precedente. */
export function Stat({
  label,
  value,
  hint,
  delta,
}: {
  label: string;
  value: string;
  hint?: string;
  /** Importo del mese corrente e del precedente, per il confronto. */
  delta?: { current: number; previous: number; previousLabel: string; format: (value: number) => string };
  /** Non cambia l'aspetto: i colori non codificano più il segno, che resta nel numero. */
  tone?: "neutral" | "good" | "bad";
}) {
  return (
    <div className="stat-card border-t border-stone-300 pt-4">
      <p className="text-sm text-stone-600">{label}</p>
      <p className="mt-2 font-display text-3xl font-semibold tabular-nums text-stone-900">{value}</p>
      {delta && <Delta {...delta} />}
      {hint && <p className="mt-2 text-xs text-stone-600">{hint}</p>}
    </div>
  );
}

/** Tono di un importo: tenuto per compatibilità, il segno è già nel numero. */
export function toneOf(cents: number): "neutral" | "good" | "bad" {
  return cents > 0 ? "good" : cents < 0 ? "bad" : "neutral";
}
