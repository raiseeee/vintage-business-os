const PAGE = 1000;

/**
 * Legge TUTTE le righe di una tabella, a pagine.
 * Il database restituisce al massimo ~1000 righe per richiesta: senza questo ciclo
 * una dashboard calcolata su dati troncati darebbe numeri sbagliati senza avvisare.
 * Si avanza di quante righe sono arrivate (non di `pageSize`) e ci si ferma solo a
 * pagina vuota, così funziona anche se il limite del progetto è più basso del previsto.
 * Le pagine devono avere un ordinamento stabile (es. per id).
 */
export async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
  pageSize = PAGE,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; ) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error("Impossibile caricare i dati");
    if (!data || data.length === 0) break;
    out.push(...data);
    from += data.length;
  }
  return out;
}
