import type { ReactNode } from "react";
import type { SupplierType } from "@/lib/suppliers/constants";
import { SUPPLIER_TYPE_LABELS } from "@/lib/suppliers/constants";

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
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <h2 className="text-base font-semibold text-stone-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

const TYPE_STYLES: Record<SupplierType, string> = {
  raccoglitore_diretto: "bg-green-100 text-green-900",
  centro_selezione: "bg-teal-100 text-teal-900",
  grossista_documentato: "bg-blue-100 text-blue-900",
  rivenditore: "bg-stone-200 text-stone-800",
  origine_non_verificata: "bg-amber-100 text-amber-900",
};

export function SupplierTypeBadge({ type }: { type: SupplierType }) {
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}>
      {SUPPLIER_TYPE_LABELS[type]}
    </span>
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
