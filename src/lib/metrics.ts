/**
 * Calcoli finanziari del gestionale. Tutti gli importi sono in CENTESIMI (interi)
 * per evitare errori di arrotondamento sui decimali.
 *
 * Regola anti doppio conteggio:
 *  - i costi di acquisto, la spedizione IN ENTRATA e gli altri costi del lotto
 *    vivono solo sul lotto;
 *  - commissioni, spedizione IN USCITA e costi extra vivono solo sulla vendita del capo.
 *  Non esiste nessun campo che possa rappresentare lo stesso costo in entrambi i posti.
 */

export type ItemStatus =
  | "da_controllare"
  | "da_fotografare"
  | "pronto"
  | "pubblicato"
  | "venduto"
  | "reso";

export interface Lot {
  id: string;
  /** Prezzo pagato per la merce. */
  purchaseCost: number;
  /** Spedizione/dogana per ricevere il lotto. */
  inboundShipping: number;
  /** Altri costi di lotto (imballi, ispezione, ecc.). */
  otherCosts: number;
  /** Numero di capi dichiarato all'acquisto. */
  quantity: number;
}

export interface Sale {
  /** Prezzo effettivo incassato dal cliente (spedizione pagata dal cliente esclusa). */
  price: number;
  /** Commissioni del canale di vendita. */
  fees: number;
  /** Spedizione al cliente pagata da te. */
  outboundShipping: number;
  /** Altri costi legati a questa vendita. */
  extraCosts: number;
  /** Materiali di consumo per capo (sacchetti, scatole…), congelati al momento della vendita. */
  materialsCost?: number;
}

export interface Item {
  id: string;
  lotId: string;
  status: ItemStatus;
  /** Prezzo di vendita previsto. */
  expectedPrice: number | null;
  sale: Sale | null;
}

export interface DashboardMetrics {
  /** Totale speso sui lotti (merce + spedizione in entrata + altri costi). */
  capitalInvested: number;
  /** Valore previsto dei capi ancora in magazzino (non venduti né resi). */
  stockValue: number;
  /** Incassi lordi dei capi venduti. */
  salesRevenue: number;
  /** Costi di vendita (commissioni + spedizione in uscita + extra + materiali per capo). */
  saleCosts: number;
  /** Costo di acquisto attribuito ai soli capi venduti. */
  costOfGoodsSold: number;
  /** Margine realizzato = incassi - costi di vendita - costo dei capi venduti. */
  realizedMargin: number;
  /** Incassi al netto dei costi di vendita (vendite - costi di vendita). */
  netRevenue: number;
  /**
   * Saldo di cassa = incassi netti - capitale investito. Negativo finché non hai
   * recuperato quanto speso; diverso dal margine realizzato perché conta l'intero
   * costo dei lotti, anche dei capi ancora da vendere.
   */
  cashBalance: number;
  soldCount: number;
  stockCount: number;
}

export function lotTotalCost(lot: Lot): number {
  return lot.purchaseCost + lot.inboundShipping + lot.otherCosts;
}

/**
 * Costo attribuito a un singolo capo: costo totale del lotto diviso per la
 * quantità DICHIARATA (non per i capi già registrati), così registrare i capi
 * a poco a poco non sposta il costo unitario.
 */
export function allocatedItemCost(lot: Lot): number {
  if (lot.quantity <= 0) return 0;
  return Math.round(lotTotalCost(lot) / lot.quantity);
}

export function saleNetRevenue(sale: Sale): number {
  return sale.price - sale.fees - sale.outboundShipping - sale.extraCosts - (sale.materialsCost ?? 0);
}

/** Profitto di un capo venduto, oppure null se non è venduto. */
export function itemProfit(item: Item, lot: Lot): number | null {
  if (item.status !== "venduto" || !item.sale) return null;
  return saleNetRevenue(item.sale) - allocatedItemCost(lot);
}

export function computeDashboard(lots: Lot[], items: Item[]): DashboardMetrics {
  const lotById = new Map(lots.map((l) => [l.id, l]));

  const capitalInvested = lots.reduce((sum, l) => sum + lotTotalCost(l), 0);

  let stockValue = 0;
  let salesRevenue = 0;
  let saleCosts = 0;
  let costOfGoodsSold = 0;
  let soldCount = 0;
  let stockCount = 0;

  for (const item of items) {
    if (item.status === "venduto" && item.sale) {
      soldCount += 1;
      salesRevenue += item.sale.price;
      saleCosts +=
        item.sale.fees + item.sale.outboundShipping + item.sale.extraCosts + (item.sale.materialsCost ?? 0);
      const lot = lotById.get(item.lotId);
      if (lot) costOfGoodsSold += allocatedItemCost(lot);
    } else if (item.status !== "reso") {
      // I capi resi sono esclusi sia dal valore dello stock sia dai ricavi:
      // vanno rivalutati a mano prima di rientrare in magazzino.
      stockCount += 1;
      stockValue += item.expectedPrice ?? 0;
    }
  }

  return {
    capitalInvested,
    stockValue,
    salesRevenue,
    saleCosts,
    costOfGoodsSold,
    realizedMargin: salesRevenue - saleCosts - costOfGoodsSold,
    netRevenue: salesRevenue - saleCosts,
    cashBalance: salesRevenue - saleCosts - capitalInvested,
    soldCount,
    stockCount,
  };
}

/** Riepilogo per ogni lotto (chiave = id del lotto), compresi i lotti senza capi. */
export function summarizeByLot(lots: Lot[], items: Item[]): Map<string, DashboardMetrics> {
  const result = new Map<string, DashboardMetrics>();
  for (const lot of lots) {
    result.set(
      lot.id,
      computeDashboard(
        [lot],
        items.filter((i) => i.lotId === lot.id),
      ),
    );
  }
  return result;
}

const eur = new Intl.NumberFormat("it-IT", {
  style: "currency",
  currency: "EUR",
});

export function formatEuro(cents: number): string {
  return eur.format(cents / 100);
}
