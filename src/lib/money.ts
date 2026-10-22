/**
 * Converte un importo scritto dall'utente in centesimi interi, senza passare
 * dai decimali in virgola mobile.
 *
 * Accetta "12", "12,5", "12.50", "1.234,56", "€ 12,50".
 * Restituisce undefined se il valore non è valido (negativo, testo, più di
 * 2 decimali) o ambiguo (es. "1.234": potrebbe essere 1,234 o 1234).
 */
export function parseEuroToCents(input: string): number | undefined {
  let s = input.replace(/[€\s]/g, "");
  if (s === "") return undefined;

  const hasComma = s.includes(",");
  const hasDot = s.includes(".");

  if (hasComma && hasDot) {
    // Il punto è il separatore delle migliaia, la virgola dei decimali.
    if (s.lastIndexOf(".") > s.lastIndexOf(",")) return undefined;
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    if ((s.match(/,/g) ?? []).length > 1) return undefined;
    s = s.replace(",", ".");
  } else if (hasDot) {
    if ((s.match(/\./g) ?? []).length > 1) return undefined;
    // "1.234" è ambiguo: meglio rifiutarlo che indovinare.
    if (/^\d+\.\d{3}$/.test(s)) return undefined;
  }

  if (!/^\d+(\.\d{1,2})?$/.test(s)) return undefined;

  const [whole, frac = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : undefined;
}

/** Centesimi → testo per un campo di input ("1250" → "12,50"). null → "". */
export function centsToInput(cents: number | null | undefined): string {
  if (cents === null || cents === undefined) return "";
  const whole = Math.trunc(cents / 100);
  const frac = String(Math.abs(cents % 100)).padStart(2, "0");
  return `${whole},${frac}`;
}
