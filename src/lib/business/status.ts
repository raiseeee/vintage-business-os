import type { ITEM_STATUSES } from "./constants";

export type ItemStatusKey = (typeof ITEM_STATUSES)[number];

/** Stati in cui un capo senza foto non può stare. */
const NEEDS_PHOTO: readonly ItemStatusKey[] = ["pronto", "pubblicato"];

/** Stati che passano a «pronto per la vendita» quando arriva la prima foto. */
const PROMOTED_BY_PHOTO: readonly ItemStatusKey[] = ["da_controllare", "da_fotografare"];

/**
 * Stato da salvare quando si chiede `requested`: senza foto un capo «pronto» o «pubblicato»
 * resta «da fotografare» (adjusted = true, per avvisare l'utente).
 */
export function statusForRequest(
  requested: ItemStatusKey,
  photoCount: number,
): { status: ItemStatusKey; adjusted: boolean } {
  if (photoCount === 0 && NEEDS_PHOTO.includes(requested)) return { status: "da_fotografare", adjusted: true };
  return { status: requested, adjusted: false };
}

/** Nuovo stato dopo l'aggiunta di una foto, oppure null se lo stato non cambia. */
export function statusAfterPhoto(current: ItemStatusKey): ItemStatusKey | null {
  return PROMOTED_BY_PHOTO.includes(current) ? "pronto" : null;
}

export const NO_PHOTO_MESSAGE = "Il capo non ha ancora foto: è rimasto «Da fotografare». Con la prima foto passa a «Pronto per la vendita».";
