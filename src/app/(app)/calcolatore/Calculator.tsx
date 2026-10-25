"use client";

import { useEffect, useMemo, useState } from "react";
import { bpToText, computeProfit, parsePercentToBp, type ProfitInput } from "@/lib/profit";
import { formatEuro } from "@/lib/metrics";
import { parseEuroToCents } from "@/lib/money";

const inputClass =
  "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm focus:border-stone-900 focus:outline-none";
const STORAGE_KEY = "vbos-calc-fees";

type Values = Record<
  "purchase" | "inboundShipping" | "prep" | "packaging" | "otherCosts" | "salePrice" | "discount" | "fee" | "feeFixed" | "outboundShipping",
  string
>;

const EURO_FIELDS: { name: keyof Values; label: string; hint?: string }[] = [
  { name: "purchase", label: "Prezzo d'acquisto del capo (€)", hint: "Dal lotto: costo del lotto diviso i capi." },
  { name: "inboundShipping", label: "Spedizione dal fornitore, per capo (€)", hint: "Già inclusa nel costo del lotto? Allora lascia 0 per non contarla due volte." },
  { name: "prep", label: "Lavaggio, riparazione, preparazione (€)" },
  { name: "packaging", label: "Imballaggio (€)" },
  { name: "otherCosts", label: "Altri costi (€)" },
];

function euro(s: string): number | undefined {
  return s.trim() === "" ? 0 : parseEuroToCents(s);
}

function loadFees(): Pick<Values, "fee" | "feeFixed" | "outboundShipping"> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function Calculator({ initial }: { initial: Partial<Values> }) {
  const [v, setV] = useState<Values>({
    purchase: "", inboundShipping: "", prep: "", packaging: "", otherCosts: "",
    salePrice: "", discount: "", fee: "", feeFixed: "", outboundShipping: "",
    ...initial,
  });

  // Le commissioni cambiano poco: si ricordano su questo dispositivo (solo comodità, non è un dato dell'attività).
  useEffect(() => {
    const saved = loadFees();
    // Lettura di una preferenza del browser dopo il montaggio (non si può fare durante il rendering sul server).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (saved) setV((cur) => ({ ...cur, ...saved }));
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ fee: v.fee, feeFixed: v.feeFixed, outboundShipping: v.outboundShipping }));
    } catch {
      /* archiviazione non disponibile: si usa comunque il calcolatore */
    }
  }, [v.fee, v.feeFixed, v.outboundShipping]);

  const set = (name: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) => setV((cur) => ({ ...cur, [name]: e.target.value }));

  const { result, errors } = useMemo(() => {
    const errs: string[] = [];
    const money = (key: keyof Values, label: string) => {
      const n = euro(v[key]);
      if (n === undefined) errs.push(label);
      return n ?? 0;
    };
    const percent = (key: keyof Values, label: string) => {
      const n = parsePercentToBp(v[key]);
      if (n === undefined) errs.push(label);
      return n ?? 0;
    };
    const input: ProfitInput = {
      purchase: money("purchase", "Prezzo d'acquisto"),
      inboundShipping: money("inboundShipping", "Spedizione dal fornitore"),
      prep: money("prep", "Lavaggio e riparazione"),
      packaging: money("packaging", "Imballaggio"),
      otherCosts: money("otherCosts", "Altri costi"),
      salePrice: money("salePrice", "Prezzo di vendita"),
      discountBp: percent("discount", "Sconto"),
      feeBp: percent("fee", "Commissione %"),
      feeFixed: money("feeFixed", "Commissione fissa"),
      outboundShipping: money("outboundShipping", "Spedizione a tuo carico"),
    };
    return { result: errs.length === 0 ? computeProfit(input) : null, errors: errs };
  }, [v]);

  const tone = (n: number) => (n > 0 ? "text-green-800" : n < 0 ? "text-red-800" : "text-stone-900");

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="space-y-6">
        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">Costi del capo</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {EURO_FIELDS.map((f) => (
              <div key={f.name}>
                <label htmlFor={f.name} className="block text-sm font-medium text-stone-700">{f.label}</label>
                <input id={f.name} inputMode="decimal" value={v[f.name]} onChange={set(f.name)} className={inputClass} />
                {f.hint && <p className="mt-1 text-xs text-stone-500">{f.hint}</p>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-stone-200 bg-white p-5">
          <h2 className="text-base font-semibold text-stone-900">Vendita</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="salePrice" className="block text-sm font-medium text-stone-700">Prezzo di vendita previsto (€)</label>
              <input id="salePrice" inputMode="decimal" value={v.salePrice} onChange={set("salePrice")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="discount" className="block text-sm font-medium text-stone-700">Sconto medio (%)</label>
              <input id="discount" inputMode="decimal" value={v.discount} onChange={set("discount")} className={inputClass} />
              <p className="mt-1 text-xs text-stone-500">Ribasso o trattativa sul prezzo di listino.</p>
            </div>
            <div>
              <label htmlFor="fee" className="block text-sm font-medium text-stone-700">Commissione del canale (%)</label>
              <input id="fee" inputMode="decimal" value={v.fee} onChange={set("fee")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="feeFixed" className="block text-sm font-medium text-stone-700">Commissione fissa (€)</label>
              <input id="feeFixed" inputMode="decimal" value={v.feeFixed} onChange={set("feeFixed")} className={inputClass} />
            </div>
            <div>
              <label htmlFor="outboundShipping" className="block text-sm font-medium text-stone-700">Spedizione a tuo carico (€)</label>
              <input id="outboundShipping" inputMode="decimal" value={v.outboundShipping} onChange={set("outboundShipping")} className={inputClass} />
            </div>
          </div>
          <p className="mt-3 text-xs text-stone-500">
            Le commissioni dipendono dalle condizioni attuali del canale (per esempio Vinted): non le do per scontate, inseriscile tu e
            controllale ogni tanto. Si ricordano su questo dispositivo.
          </p>
        </section>
      </div>

      <aside className="h-fit rounded-lg border border-stone-200 bg-white p-5 lg:sticky lg:top-6" aria-live="polite">
        <h2 className="text-base font-semibold text-stone-900">Risultato</h2>
        {!result ? (
          <p className="mt-3 text-sm text-red-700">Controlla questi campi: {errors.join(", ")}.</p>
        ) : (
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Prezzo incassato (dopo lo sconto)" value={formatEuro(result.soldPrice)} />
            <Row label="Commissioni" value={`− ${formatEuro(result.fees)}`} />
            <Row label="Ricavo netto" value={formatEuro(result.netRevenue)} />
            <Row label="Costi totali" value={`− ${formatEuro(result.totalCosts)}`} />
            <div className="border-t border-stone-200 pt-2">
              <Row label="Profitto netto" value={formatEuro(result.profit)} valueClass={`text-lg font-semibold ${tone(result.profit)}`} />
            </div>
            <Row label="Margine (sul prezzo incassato)" value={bpToText(result.marginBp)} />
            <Row label="ROI (sui costi)" value={bpToText(result.roiBp)} />
            <div className="border-t border-stone-200 pt-2">
              <Row
                label="Prezzo minimo per non perdere"
                value={result.breakEvenPrice !== null ? formatEuro(result.breakEvenPrice) : "—"}
              />
              <p className="mt-1 text-xs text-stone-500">Prezzo di listino più basso con profitto di almeno 0, tenendo conto di sconto e commissioni.</p>
            </div>
            {result.profit < 0 && <p className="rounded-md bg-red-50 p-2 text-xs text-red-800">A questo prezzo vendi in perdita.</p>}
          </dl>
        )}
      </aside>

      <section className="rounded-lg border border-stone-200 bg-stone-50 p-5 text-sm text-stone-700 lg:col-span-2">
        <h2 className="text-base font-semibold text-stone-900">Come si calcola</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li><strong>Prezzo incassato</strong> = prezzo di vendita × (1 − sconto)</li>
          <li><strong>Commissioni</strong> = prezzo incassato × commissione % + commissione fissa</li>
          <li><strong>Ricavo netto</strong> = prezzo incassato − commissioni − spedizione a tuo carico</li>
          <li><strong>Costi totali</strong> = acquisto + spedizione dal fornitore + lavaggio/riparazione + imballaggio + altri costi</li>
          <li><strong>Profitto netto</strong> = ricavo netto − costi totali · <strong>Margine</strong> = profitto / prezzo incassato · <strong>ROI</strong> = profitto / costi totali</li>
        </ul>
      </section>
    </div>
  );
}

function Row({ label, value, valueClass = "text-stone-900" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-stone-600">{label}</dt>
      <dd className={`tabular-nums ${valueClass}`}>{value}</dd>
    </div>
  );
}
