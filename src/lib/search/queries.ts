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

// ---------------------------------------------------------------------------
// Tipologie di fornitura (le caselle del menu)
// ---------------------------------------------------------------------------
export const BOX_TYPES = ["miste", "kg", "originale", "crema", "balle", "sportswear"] as const;
export type BoxType = (typeof BOX_TYPES)[number];

export const BOX_TYPE_INFO: Record<BoxType, { label: string; hint: string }> = {
  miste: {
    label: "Box miste",
    hint: "Scatole già composte con capi misti. Comode per un primo lotto piccolo; il contenuto va verificato.",
  },
  kg: {
    label: "Vendita al kg",
    hint: "Prezzo a peso: permette lotti di prova da 10–20 kg. Controlla sempre il peso minimo e la spedizione.",
  },
  originale: {
    label: "Originale / non selezionato",
    hint: "Merce così come raccolta (unsorted): costa meno al kg ma serve tempo per selezionare e c'è più scarto.",
  },
  crema: {
    label: "Selezionato / crème",
    hint: "Prima scelta già scremata: meno lavoro per te e capi più rivendibili, ma prezzo al kg più alto.",
  },
  balle: {
    label: "Balle e pallet",
    hint: "Volumi grandi, spesso con minimi alti: di solito arrivano dopo il lotto di prova.",
  },
  sportswear: {
    label: "Sportswear e marchi",
    hint: "Cerca chi cita Nike, Adidas e simili. È un indizio nel testo, non la garanzia che ci siano.",
  },
};

/** Tipologie suggerite per cominciare con un budget piccolo (precompilate nel menu). */
export const STARTER_TYPES: BoxType[] = ["miste", "kg", "originale"];

// ---------------------------------------------------------------------------
// Profondità: quante ricerche lanciare (ogni ricerca consuma crediti del servizio)
// ---------------------------------------------------------------------------
export const DEPTHS = ["rapida", "standard", "approfondita"] as const;
export type Depth = (typeof DEPTHS)[number];

export const DEPTH_INFO: Record<Depth, { label: string; maxQueries: number }> = {
  rapida: { label: "Rapida · fino a 6 ricerche", maxQueries: 6 },
  standard: { label: "Standard · fino a 14 ricerche", maxQueries: 14 },
  approfondita: { label: "Approfondita · fino a 30 ricerche", maxQueries: 30 },
};

// ---------------------------------------------------------------------------
// Parole di settore per lingua. Sono traduzioni di lavoro: da raffinare con l'uso.
// ---------------------------------------------------------------------------
interface Lang {
  clothes: string;
  base: string;
  types: Partial<Record<BoxType, string>>;
}

const EN: Lang = {
  clothes: "used clothing",
  base: "used clothing wholesale sorting collection",
  types: {
    miste: "mixed boxes",
    kg: "wholesale per kg",
    originale: "unsorted original",
    crema: "cream grade first choice",
    balle: "bales pallets",
  },
};

const LANGS: Record<Area, Lang> = {
  europa: EN,
  GB: EN,
  IT: {
    clothes: "abiti usati",
    base: "abiti usati ingrosso selezione raccolta",
    types: { miste: "box miste", kg: "al kg", originale: "non selezionato originale", crema: "crema prima scelta", balle: "balle" },
  },
  DE: {
    clothes: "Altkleider",
    base: "Altkleider Großhandel Sortierung Export",
    types: { miste: "Mischpakete", kg: "pro Kilo", originale: "unsortiert Original", crema: "Cream Ware Premium", balle: "Ballen" },
  },
  NL: {
    clothes: "tweedehands kleding",
    base: "tweedehands kleding groothandel sortering inzameling",
    types: { miste: "gemengde dozen", kg: "per kilo", originale: "ongesorteerd origineel", crema: "crème kwaliteit", balle: "balen" },
  },
  BE: {
    clothes: "tweedehands kleding",
    base: "tweedehandskleding groothandel sortering",
    types: { miste: "gemengde dozen", kg: "per kilo", originale: "ongesorteerd", crema: "crème kwaliteit", balle: "balen" },
  },
  FR: {
    clothes: "vêtements d'occasion",
    base: "vêtements d'occasion tri textile collecte grossiste",
    types: { miste: "lots mixtes", kg: "au kilo", originale: "non trié original", crema: "crème qualité", balle: "balles" },
  },
  PL: {
    clothes: "odzież używana",
    base: "odzież używana hurt sortownia",
    types: { miste: "paczki mix", kg: "na kilogramy", originale: "nieposortowana", crema: "krem", balle: "belki" },
  },
  LT: { clothes: "naudoti drabužiai", base: "naudoti drabužiai urmu rūšiavimas", types: {} },
  SE: { clothes: "second hand kläder", base: "second hand kläder grossist sortering", types: {} },
  DK: { clothes: "genbrugstøj", base: "genbrugstøj grossist sortering", types: {} },
};

const EUROPE_SMALL: Area[] = ["europa", "DE", "NL", "FR", "PL", "IT"];
const EUROPE_FULL: Area[] = ["europa", "DE", "NL", "FR", "PL", "IT", "BE", "GB", "LT", "SE", "DK"];

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

export interface SearchRequest {
  term: string;
  product: string;
  area: Area;
  types: BoxType[];
  depth: Depth;
}

function productFor(product: string, area: Area): string {
  const p = product.trim().toLowerCase();
  if (!p) return "";
  return area === "IT" ? p : (PRODUCT_EN[p] ?? p);
}

function join(...parts: string[]): string {
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/**
 * Costruisce le query: per ogni Paese una ricerca generale e una per ogni tipologia scelta,
 * nella lingua del posto. Le query sono intercalate tra i Paesi, così il limite di profondità
 * non taglia fuori nessun Paese.
 */
export function buildQueries({ term, product, area, types, depth }: SearchRequest): string[] {
  const areas: Area[] = area === "europa" ? (depth === "rapida" ? EUROPE_SMALL : EUROPE_FULL) : [area];
  const t = term.trim();

  const perArea: string[][] = areas.map((a) => {
    const lang = LANGS[a];
    const prod = productFor(product, a);
    const list = [join(lang.base, t, prod)];
    for (const type of types) {
      const phrase = type === "sportswear" ? "Nike Adidas sportswear" : (lang.types[type] ?? EN.types[type] ?? "");
      if (phrase) list.push(join(lang.clothes, phrase, t, prod));
    }
    // Un Paese singolo: variante in inglese, spesso usata dagli esportatori.
    if (area !== "europa" && area !== "GB") {
      list.push(join("used clothing wholesale export", AREA_LABELS_EN[a] ?? "", t, productFor(product, "GB")));
    }
    return list;
  });

  const out: string[] = [];
  const longest = Math.max(...perArea.map((l) => l.length));
  for (let i = 0; i < longest; i++) {
    for (const list of perArea) if (list[i]) out.push(list[i]);
  }
  return [...new Set(out)].slice(0, DEPTH_INFO[depth].maxQueries);
}

const AREA_LABELS_EN: Partial<Record<Area, string>> = {
  IT: "Italy", DE: "Germany", NL: "Netherlands", BE: "Belgium", FR: "France", PL: "Poland",
  LT: "Lithuania", GB: "UK", SE: "Sweden", DK: "Denmark",
};

export function parseArea(v: string): Area {
  return (AREAS as readonly string[]).includes(v) ? (v as Area) : "europa";
}

export function parseDepth(v: string): Depth {
  return (DEPTHS as readonly string[]).includes(v) ? (v as Depth) : "standard";
}

export function parseTypes(values: string[]): BoxType[] {
  return BOX_TYPES.filter((t) => values.includes(t));
}
