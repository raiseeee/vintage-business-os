"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import type { FormState } from "@/components/form";
import {
  AREAS,
  AREA_LABELS,
  BOX_TYPES,
  BOX_TYPE_INFO,
  DEPTHS,
  DEPTH_INFO,
  STARTER_TYPES,
  type BoxType,
  type Depth,
} from "@/lib/search/queries";
import { runSearch } from "./actions";

const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none";

function Submit({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      className="rounded-md bg-stone-900 px-5 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-50"
    >
      {pending ? "Ricerca in corso…" : "Cerca fornitori"}
    </button>
  );
}

export function SearchForm({ enabled }: { enabled: boolean }) {
  // Campi controllati: React 19 svuota i campi non controllati dopo ogni invio, anche in caso di errore.
  const [term, setTerm] = useState("");
  const [product, setProduct] = useState("");
  const [area, setArea] = useState("europa");
  const [depth, setDepth] = useState<Depth>("standard");
  const [types, setTypes] = useState<BoxType[]>(STARTER_TYPES);

  const [state, action] = useActionState<FormState, FormData>(runSearch, { error: null, ok: false });

  const toggle = (t: BoxType) => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <form action={action} className="space-y-5 rounded-lg border border-stone-200 bg-white p-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label htmlFor="q" className="block text-xs font-medium text-stone-600">Cosa cerchi (parole libere, facoltativo)</label>
          <input id="q" name="q" value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Es. stock originale, lotti piccoli" className={inputClass} />
        </div>
        <div>
          <label htmlFor="prodotto" className="block text-xs font-medium text-stone-600">Tipo di prodotto</label>
          <input id="prodotto" name="prodotto" value={product} onChange={(e) => setProduct(e.target.value)} placeholder="jeans, maglie, felpe…" className={inputClass} />
        </div>
        <div>
          <label htmlFor="area" className="block text-xs font-medium text-stone-600">Dove</label>
          <select id="area" name="area" value={area} onChange={(e) => setArea(e.target.value)} className={inputClass}>
            {AREAS.map((a) => (
              <option key={a} value={a}>{AREA_LABELS[a]}</option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="profondita" className="block text-xs font-medium text-stone-600">Quanto in profondità</label>
          <select id="profondita" name="profondita" value={depth} onChange={(e) => setDepth(e.target.value as Depth)} className={inputClass}>
            {DEPTHS.map((d) => (
              <option key={d} value={d}>{DEPTH_INFO[d].label}</option>
            ))}
          </select>
        </div>
      </div>

      <fieldset>
        <legend className="text-sm font-semibold text-stone-900">Che tipo di fornitura ti interessa?</legend>
        <p className="mt-1 text-xs text-stone-500">
          Ogni casella aggiunge ricerche mirate. Per un primo lotto di prova sono già selezionate quelle consigliate; puoi cambiarle.
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {BOX_TYPES.map((t) => (
            <label
              key={t}
              className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 text-sm ${
                types.includes(t) ? "border-stone-900 bg-stone-50" : "border-stone-200 hover:bg-stone-50"
              }`}
            >
              <input type="checkbox" name="tipo" value={t} checked={types.includes(t)} onChange={() => toggle(t)} className="mt-1" />
              <span>
                <span className="font-medium text-stone-900">{BOX_TYPE_INFO[t].label}</span>
                <span className="block text-xs text-stone-600">{BOX_TYPE_INFO[t].hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-4">
        <Submit disabled={!enabled} />
        <p className="text-xs text-stone-500">
          Ogni ricerca consuma crediti del servizio (di norma 1 per query, da verificare sul tuo piano). Può richiedere fino a un minuto.
        </p>
      </div>
      {state.error && (
        <p role="alert" className="text-sm text-red-700">{state.error}</p>
      )}
    </form>
  );
}
