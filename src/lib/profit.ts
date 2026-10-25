/**
 * Calcolatore di redditività di un capo. Importi in CENTESIMI (interi); le percentuali in
 * centesimi di punto (1250 = 12,50%) per evitare i decimali in virgola mobile.
 *
 * Formule (tutte verificabili a mano):
 *   prezzo incassato   = prezzo di vendita × (1 − sconto)
 *   commissioni        = prezzo incassato × commissione% + commissione fissa
 *   ricavo netto       = prezzo incassato − commissioni − spedizione a carico tuo
 *   costi totali       = acquisto + spedizione dal fornitore + lavaggio/riparazione + imballaggio + altri
 *   profitto netto     = ricavo netto − costi totali
 *   margine %          = profitto netto / prezzo incassato
 *   ROI %              = profitto netto / costi totali
 *   prezzo minimo      = il prezzo di vendita più basso (prima dello sconto) con profitto ≥ 0
 */

export interface ProfitInput {
  purchase: number;
  inboundShipping: number;
  prep: number;
  packaging: number;
  otherCosts: number;
  salePrice: number;
  /** Sconto in centesimi di punto percentuale (0–10000). */
  discountBp: number;
  /** Commissione in centesimi di punto percentuale (0–10000). */
  feeBp: number;
  feeFixed: number;
  outboundShipping: number;
}

export interface ProfitResult {
  soldPrice: number;
  fees: number;
  netRevenue: number;
  totalCosts: number;
  profit: number;
  /** Centesimi di punto percentuale; null se il prezzo incassato è 0. */
  marginBp: number | null;
  roiBp: number | null;
  /** Prezzo di vendita minimo per non andare in perdita; null se non esiste (commissioni+sconto ≥ 100%). */
  breakEvenPrice: number | null;
}

const BP = 10_000;

export function totalCosts(i: ProfitInput): number {
  return i.purchase + i.inboundShipping + i.prep + i.packaging + i.otherCosts;
}

function evaluate(i: ProfitInput, salePrice: number) {
  const soldPrice = Math.round((salePrice * (BP - i.discountBp)) / BP);
  const fees = Math.round((soldPrice * i.feeBp) / BP) + i.feeFixed;
  const netRevenue = soldPrice - fees - i.outboundShipping;
  return { soldPrice, fees, netRevenue };
}

export function computeProfit(i: ProfitInput): ProfitResult {
  const { soldPrice, fees, netRevenue } = evaluate(i, i.salePrice);
  const costs = totalCosts(i);
  const profit = netRevenue - costs;

  return {
    soldPrice,
    fees,
    netRevenue,
    totalCosts: costs,
    profit,
    marginBp: soldPrice > 0 ? Math.round((profit * BP) / soldPrice) : null,
    roiBp: costs > 0 ? Math.round((profit * BP) / costs) : null,
    breakEvenPrice: breakEven(i),
  };
}

function breakEven(i: ProfitInput): number | null {
  const keep = ((BP - i.discountBp) * (BP - i.feeBp)) / (BP * BP);
  if (keep <= 0) return null;
  const needed = totalCosts(i) + i.feeFixed + i.outboundShipping;
  let price = Math.ceil(needed / keep);
  // Gli arrotondamenti di sconto e commissione possono far mancare 1-2 centesimi.
  for (let n = 0; n < 5 && totalCosts(i) > evaluate(i, price).netRevenue; n++) price += 1;
  return price;
}

/** "12,5" → 1250 (centesimi di punto). Valido da 0 a 100; altrimenti undefined. */
export function parsePercentToBp(input: string): number | undefined {
  const s = input.replace(/[%\s]/g, "").replace(",", ".");
  if (s === "") return 0;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;
  const bp = Math.round(Number(s) * 100);
  return bp >= 0 && bp <= BP ? bp : undefined;
}

export function bpToText(bp: number | null): string {
  if (bp === null) return "—";
  return `${(bp / 100).toLocaleString("it-IT", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}
