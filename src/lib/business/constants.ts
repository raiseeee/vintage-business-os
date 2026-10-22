export const ITEM_STATUSES = [
  "da_controllare",
  "da_fotografare",
  "pronto",
  "pubblicato",
  "venduto",
  "reso",
] as const;

export const ITEM_STATUS_LABELS: Record<(typeof ITEM_STATUSES)[number], string> = {
  da_controllare: "Da controllare",
  da_fotografare: "Da fotografare",
  pronto: "Pronto per la vendita",
  pubblicato: "Pubblicato",
  venduto: "Venduto",
  reso: "Reso",
};

/** Stati impostabili a mano: «venduto» si ottiene solo registrando una vendita. */
export const MANUAL_ITEM_STATUSES = ITEM_STATUSES.filter((s) => s !== "venduto");

export const ITEM_CONDITIONS = ["ottima", "buona", "discreta", "da_riparare"] as const;

export const ITEM_CONDITION_LABELS: Record<(typeof ITEM_CONDITIONS)[number], string> = {
  ottima: "Ottima",
  buona: "Buona",
  discreta: "Discreta",
  da_riparare: "Da riparare",
};

/** Solo suggerimenti per il campo libero «canale di vendita». */
export const CHANNEL_SUGGESTIONS = ["Vinted", "Depop", "eBay", "Instagram", "Mercatino", "Di persona"];

export const PHOTO_BUCKET = "item-photos";
export const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
export const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};
