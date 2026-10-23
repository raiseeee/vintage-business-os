import Link from "next/link";
import { ActionForm } from "@/components/form";
import { ExternalLink } from "@/components/ui";
import { LIKELIHOOD_LABELS, type Likelihood } from "@/lib/search/classify";
import type { SearchResultRow } from "@/lib/search/store";
import { addFromSearch } from "./actions";

const BADGE: Record<Likelihood, string> = {
  monte: "bg-green-100 text-green-900",
  incerto: "bg-stone-200 text-stone-800",
  rivenditore: "bg-amber-100 text-amber-900",
};

export function CandidateCard({
  c,
  existingId,
  extra,
}: {
  c: SearchResultRow;
  existingId?: string;
  extra?: string;
}) {
  return (
    <li className="rounded-lg border border-stone-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium text-stone-900">{c.name}</p>
          <p className="text-xs text-stone-500">
            <ExternalLink href={c.url}>{c.domain}</ExternalLink>
            {c.country && ` · ${c.country} (dedotto dal dominio)`}
            {extra && ` · ${extra}`}
          </p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${BADGE[c.likelihood]}`}>
          {LIKELIHOOD_LABELS[c.likelihood]}
        </span>
      </div>
      {c.snippet && <p className="mt-2 text-sm text-stone-700">{c.snippet}</p>}
      <ul className="mt-2 list-disc pl-5 text-xs text-stone-500">
        {c.reasons.map((r) => (
          <li key={r}>{r}</li>
        ))}
      </ul>
      <div className="mt-3">
        {existingId ? (
          <p className="text-sm text-stone-600">
            Già nei tuoi fornitori:{" "}
            <Link href={`/fornitori/${existingId}`} className="font-medium text-stone-900 underline">apri la scheda</Link>
          </p>
        ) : (
          <ActionForm action={addFromSearch} submitLabel="Aggiungi ai fornitori" successMessage="Aggiunto: lo trovi in Supplier Finder." variant="quiet">
            <input type="hidden" name="name" value={c.name} />
            <input type="hidden" name="website" value={c.root_url} />
            <input type="hidden" name="country" value={c.country ?? ""} />
            <input type="hidden" name="source_title" value={c.title || c.name} />
            <input type="hidden" name="source_url" value={c.url} />
            <input type="hidden" name="snippet" value={c.snippet.slice(0, 300)} />
          </ActionForm>
        )}
      </div>
    </li>
  );
}
