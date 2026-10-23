import { describe, expect, it } from "vitest";
import { buildCandidates, countryFromDomain, domainOf, nameFromTitle } from "./classify";
import { parseBraveResults, parseTavilyResults } from "./parse";
import { buildQueries, parseArea } from "./queries";

describe("parse", () => {
  it("legge Brave e pulisce l'HTML", () => {
    const r = parseBraveResults({ web: { results: [{ title: "A <b>Co</b>", url: "https://a.de/x", description: "Alt &amp; neu" }, { title: "x", url: "javascript:1" }] } });
    expect(r).toEqual([{ title: "A Co", url: "https://a.de/x", snippet: "Alt & neu" }]);
  });
  it("legge Tavily e tollera risposte vuote", () => {
    expect(parseTavilyResults({ results: [{ title: "T", url: "https://t.nl", content: "c" }] })).toHaveLength(1);
    expect(parseTavilyResults(null)).toEqual([]);
    expect(parseBraveResults({})).toEqual([]);
  });
});

import { runSearches } from "./run";
import { DEPTH_INFO } from "./queries";

describe("queries (tipologie e profondità)", () => {
  const base = { term: "", product: "jeans" };
  it("ogni casella aggiunge una ricerca per Paese, nella lingua locale", () => {
    const q = buildQueries({ ...base, area: "DE", types: ["kg", "miste"], depth: "approfondita" });
    expect(q.some((x) => x.includes("pro Kilo"))).toBe(true);
    expect(q.some((x) => x.includes("Mischpakete"))).toBe(true);
  });
  it("rispetta il limite di profondità e copre più Paesi", () => {
    const q = buildQueries({ ...base, area: "europa", types: ["miste", "kg", "originale"], depth: "rapida" });
    expect(q.length).toBeLessThanOrEqual(DEPTH_INFO.rapida.maxQueries);
    expect(q.some((x) => x.includes("Altkleider"))).toBe(true);
    expect(q.some((x) => x.includes("tweedehands"))).toBe(true);
    const deep = buildQueries({ ...base, area: "europa", types: ["miste", "kg", "originale"], depth: "approfondita" });
    expect(deep.length).toBeGreaterThan(q.length);
    expect(deep.length).toBeLessThanOrEqual(DEPTH_INFO.approfondita.maxQueries);
  });
  it("lingue senza frasi proprie ripiegano sull'inglese", () => {
    const q = buildQueries({ ...base, area: "LT", types: ["kg"], depth: "standard" });
    expect(q.some((x) => x.includes("naudoti drabužiai") && x.includes("wholesale per kg"))).toBe(true);
  });
});

describe("filtri immagini", () => {
  it("scarta foto d'archivio e file immagine", () => {
    const c = buildCandidates([
      { title: "Jeans photo", url: "https://www.shutterstock.com/search/jeans", snippet: "" },
      { title: "x", url: "https://azienda.de/images/jeans.jpg", snippet: "" },
      { title: "y", url: "https://azienda.de/foto.png?x=1", snippet: "" },
      { title: "Textil Sortierung", url: "https://azienda.de/", snippet: "Altkleider Sortierung" },
    ]);
    expect(c.map((x) => x.domain)).toEqual(["azienda.de"]);
  });
});

describe("runSearches", () => {
  it("un errore non ferma le altre query", async () => {
    const provider = {
      name: "finto",
      search: async ({ text }: { text: string }) => {
        if (text === "b") throw new Error("boom");
        return [{ title: text, url: `https://${text}.de`, snippet: "" }];
      },
    };
    const out = await runSearches(provider, ["a", "b", "c", "d", "e"], 2);
    expect(out.results).toHaveLength(4);
    expect(out.failed).toBe(1);
    expect(out.firstError).toBe("boom");
  });
});

describe("queries", () => {
  it("Europa: più lingue, massimo 6 query, include i termini dell'utente", () => {
    const q = buildQueries({ term: "box", product: "jeans", area: "europa", types: [], depth: "rapida" });
    expect(q.length).toBeGreaterThan(3);
    expect(q.length).toBeLessThanOrEqual(6);
    expect(q.every((x) => x.includes("box"))).toBe(true);
  });
  it("un Paese: query locale + variante inglese", () => {
    const q = buildQueries({ term: "", product: "felpe", area: "DE", types: [], depth: "rapida" });
    expect(q[0]).toContain("Altkleider");
    expect(q.some((x) => x.includes("sweatshirts"))).toBe(true);
  });
  it("area sconosciuta → Europa", () => {
    expect(parseArea("zz")).toBe("europa");
  });
});

describe("classify", () => {
  it("scarta marketplace e unisce per dominio", () => {
    const c = buildCandidates([
      { title: "Vinted", url: "https://www.vinted.it/x", snippet: "" },
      { title: "Textil GmbH | Sortierung", url: "https://www.textil.de/a", snippet: "Altkleider Sortierung, Großhandel, 500 Tonnen" },
      { title: "Textil GmbH", url: "https://textil.de/b", snippet: "" },
    ]);
    expect(c).toHaveLength(1);
    expect(c[0].domain).toBe("textil.de");
    expect(c[0].likelihood).toBe("monte");
    expect(c[0].country).toBe("DE");
    expect(c[0].name).toBe("Textil GmbH");
  });
  it("riconosce un negozio al dettaglio", () => {
    const [c] = buildCandidates([{ title: "Vintage Store", url: "https://shop.com", snippet: "Shop now, free shipping, add to cart" }]);
    expect(c.likelihood).toBe("rivenditore");
    expect(c.country).toBeNull();
  });
  it("utility", () => {
    expect(domainOf("https://www.A.com/x")).toBe("a.com");
    expect(domainOf("boh")).toBeNull();
    expect(countryFromDomain("x.com")).toBeNull();
    expect(nameFromTitle("Acme – Used clothing", "acme.com")).toBe("Acme");
  });
});
