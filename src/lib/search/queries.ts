export const AREAS = ["europa", "IT", "DE", "NL", "BE", "FR", "PL", "LT", "GB", "SE", "DK"] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  europa: "Tutta Europa",
  IT: "Italia",
  DE: "Germania",
  NL: "Paesi Bassi",
  BE: "Belgio",
  FR: "Francia",
  PL: "Polonia",
  LT: "Lituania",
  GB: "Regno Unito",
  SE: "Svezia",
  DK: "Danimarca",
};

/** Parole di settore nella lingua del Paese: raccolta, selezione, ingrosso di abiti usati. */
const BASE: Record<Area, string[]> = {
  europa: ["used clothing wholesale sorting collection Europe"],
  IT: ["abiti usati ingrosso selezione raccolta"],
  DE: ["Altkleider Großhandel Sortierung Export"],
  NL: ["tweedehands kleding groothandel sortering inzameling"],
  BE: ["tweedehandskleding groothandel sortering", "vêtements d'occasion tri grossiste Belgique"],
  FR: ["vêtements d'occasion tri textile collecte grossiste"],
  PL: ["odzież używana hurt sortownia"],
  LT: ["naudoti drabužiai urmu rūšiavimas"],
  GB: ["used clothing wholesale sorting collection UK"],
  SE: ["second hand kläder grossist sortering"],
  DK: ["genbrugstøj grossist sortering"],
};

/** Per «Tutta Europa» si cerca in queste lingue, a turno (limite di richieste per ricerca). */
const EUROPE_SET: Area[] = ["europa", "DE", "NL", "FR", "PL", "IT"];

/** Prodotti comuni in italiano → inglese, per le query fuori dall'Italia. */
const PRODUCT_EN: Record<string, string> = {
  jeans: "jeans denim",
  maglie: "t-shirts sweaters",
  maglietta: "t-shirts",
  magliette: "t-shirts",
  felpe: "sweatshirts hoodies",
  giacche: "jackets",
  giubbotti: "jackets",
  pantaloni: "trousers",
  scarpe: "shoes",
  borse: "bags",
};

export const MAX_QUERIES = 6;

export interface SearchRequest {
  term: string;
  product: string;
  area: Area;
}

function productFor(product: string, area: Area): string {
  const p = product.trim().toLowerCase();
  if (!p) return "";
  return area === "IT" ? p : (PRODUCT_EN[p] ?? p);
}

/** Costruisce le query: parole di settore del Paese + ciò che l'utente cerca + il prodotto. */
export function buildQueries({ term, product, area }: SearchRequest): string[] {
  const areas: Area[] = area === "europa" ? EUROPE_SET : [area];
  const queries: string[] = [];
  for (const a of areas) {
    for (const base of BASE[a]) {
      const text = [base, term.trim(), productFor(product, a)].filter(Boolean).join(" ");
      queries.push(text.replace(/\s+/g, " "));
    }
  }
  // Un solo Paese: aggiunge anche una variante in inglese, spesso usata dagli esportatori.
  if (area !== "europa" && area !== "GB") {
    const en = ["used clothing wholesale export", area, term.trim(), productFor(product, "GB")].filter(Boolean).join(" ");
    queries.push(en.replace(/\s+/g, " "));
  }
  return [...new Set(queries)].slice(0, MAX_QUERIES);
}

export function parseArea(v: string): Area {
  return (AREAS as readonly string[]).includes(v) ? (v as Area) : "europa";
}
