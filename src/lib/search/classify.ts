import type { WebSearchResult } from "./types";

/** Siti che non sono fornitori: marketplace, social, enciclopedie, notizie. */
const EXCLUDED = [
  "ebay.", "vinted.", "etsy.", "amazon.", "alibaba.", "aliexpress.", "depop.", "wallapop.", "subito.it",
  "facebook.", "instagram.", "tiktok.", "youtube.", "pinterest.", "reddit.", "twitter.", "x.com", "linkedin.",
  "wikipedia.", "wikimedia.", "google.", "bing.", "trustpilot.", "medium.com",
  // Foto d'archivio e immagini: non sono aziende.
  "shutterstock.", "istockphoto.", "gettyimages.", "alamy.", "freepik.", "unsplash.", "pexels.", "pixabay.",
  "dreamstime.", "depositphotos.", "123rf.", "flickr.", "adobestock.", "stock.adobe.", "vecteezy.", "canva.", "imgur.",
  // Grandi negozi di moda al dettaglio.
  "zalando.", "asos.", "zara.", "hm.com", "shein.", "temu.", "levi.com", "nike.com", "adidas.", "ikea.", "otto.de",
];

/** Estensioni di file immagine: un risultato che punta a un'immagine non è un'azienda. */
const IMAGE_URL = /\.(jpe?g|png|gif|webp|svg|avif|bmp)(\?|$)/i;
const IMAGE_PATH = /\/(images?|photos?|stock-photos?|wallpapers?|pictures?)\//i;

export function isImageUrl(url: string): boolean {
  return IMAGE_URL.test(url) || IMAGE_PATH.test(url);
}

export function domainOf(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}

export function isExcluded(domain: string): boolean {
  return EXCLUDED.some((e) => domain.includes(e));
}

const TLD_COUNTRY: Record<string, string> = {
  it: "IT", de: "DE", nl: "NL", be: "BE", fr: "FR", pl: "PL", lt: "LT", uk: "GB", se: "SE", dk: "DK",
  es: "ES", pt: "PT", at: "AT", ch: "CH", fi: "FI", no: "NO", ie: "IE", lv: "LV", ee: "EE", cz: "CZ", ro: "RO", bg: "BG", hu: "HU",
};

/** Paese dedotto dall'estensione del dominio (.de → DE). null se generica (.com): non si indovina. */
export function countryFromDomain(domain: string): string | null {
  const tld = domain.split(".").pop() ?? "";
  return TLD_COUNTRY[tld] ?? null;
}

// Segnali nel testo del risultato. Sono indizi, non prove.
const UPSTREAM = [
  "sorting", "sortierung", "sortierbetrieb", "sortering", "sortownia", "tri textile", "tri et", "selezione", "rūšiavimas",
  "collection", "collecte", "inzameling", "raccolta", "sammlung", "altkleidersammlung", "zbiórka",
  "unsorted", "original", "ungesorteerd", "unsortiert", "non triés", "non selezionat",
  "textile recycling", "recycling", "riciclo", "recycl", "tonnes", "tonnellate", "tonnen", "ton per",
  "clothing bank", "charity", "container", "kledingbank", "altkleidercontainer", "licen", "authoris", "zugelassen", "erlaubnis",
];
const WHOLESALE = ["wholesale", "großhandel", "grosshandel", "groothandel", "grossiste", "ingrosso", "hurt", "urmu", "grossist", "export"];
const RETAIL = [
  "add to cart", "aggiungi al carrello", "in den warenkorb", "shop now", "buy now", "compra ora", "free shipping", "spedizione gratuita",
  "/product/", "/products/", "/prodotto/", "/produkt/", "/shop/", "/cart", "image of", "photo of", "immagini", "foto stock", "stock photo", "royalty free", "wallpaper",
  "boutique", "online shop", "webshop", "negozio online", "vintage shop", "vintage store", "per piece", "al pezzo", "pro stück", "sale -", "% off",
];

export type Likelihood = "monte" | "incerto" | "rivenditore";

export const LIKELIHOOD_LABELS: Record<Likelihood, string> = {
  monte: "Possibile fornitore a monte",
  incerto: "Da capire",
  rivenditore: "Probabile rivenditore",
};

export interface Candidate {
  domain: string;
  name: string;
  url: string;
  rootUrl: string;
  country: string | null;
  snippet: string;
  title: string;
  likelihood: Likelihood;
  /** Motivi leggibili del giudizio. */
  reasons: string[];
  score: number;
}

function hits(text: string, words: string[]): string[] {
  return words.filter((w) => text.includes(w));
}

/** Nome azienda dal titolo della pagina: primo segmento prima di | - – — · :. */
export function nameFromTitle(title: string, domain: string): string {
  const first = title.split(/\s[|\-–—·:]\s|[|–—·]/)[0]?.trim() ?? "";
  const name = first.length >= 2 ? first : domain;
  return name.slice(0, 80);
}

export function classify(result: WebSearchResult): Omit<Candidate, "domain" | "name" | "url" | "rootUrl" | "country" | "snippet" | "title"> {
  const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  const up = hits(text, UPSTREAM);
  const wh = hits(text, WHOLESALE);
  const re = hits(text, RETAIL);

  const score = Math.min(up.length, 4) + Math.min(wh.length, 1) - Math.min(re.length, 3) * 2;
  const reasons: string[] = [];
  if (up.length) reasons.push(`Parole di raccolta/selezione: ${up.slice(0, 4).join(", ")}`);
  if (wh.length) reasons.push(`Parole di ingrosso/esportazione: ${wh.slice(0, 2).join(", ")}`);
  if (re.length) reasons.push(`Parole da negozio al dettaglio: ${re.slice(0, 3).join(", ")}`);
  if (!reasons.length) reasons.push("Nessun indizio chiaro nel testo del risultato");

  const likelihood: Likelihood = re.length >= 1 && re.length >= up.length ? "rivenditore" : score >= 2 ? "monte" : "incerto";
  return { likelihood, reasons, score };
}

/** Unisce i risultati di più query: scarta i siti non fornitori, un candidato per dominio. */
export function buildCandidates(results: WebSearchResult[]): Candidate[] {
  const byDomain = new Map<string, Candidate>();
  for (const r of results) {
    const domain = domainOf(r.url);
    if (!domain || isExcluded(domain) || isImageUrl(r.url)) continue;
    const c = classify(r);
    const existing = byDomain.get(domain);
    if (existing && existing.score >= c.score) continue;
    byDomain.set(domain, {
      domain,
      name: nameFromTitle(r.title, domain),
      url: r.url,
      rootUrl: `https://${domain}`,
      country: countryFromDomain(domain),
      snippet: r.snippet,
      title: r.title || domain,
      ...c,
    });
  }
  return [...byDomain.values()].sort((a, b) => b.score - a.score || a.domain.localeCompare(b.domain));
}
