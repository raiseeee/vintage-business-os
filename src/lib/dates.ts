/** Data di oggi (AAAA-MM-GG) nel fuso orario italiano, per i valori iniziali dei form. */
export function todayIso(now: Date = new Date()): string {
  return now.toLocaleDateString("sv-SE", { timeZone: "Europe/Rome" });
}
