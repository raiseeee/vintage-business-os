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

describe("queries", () => {
  it("Europa: più lingue, massimo 6 query, include i termini dell'utente", () => {
    const q = buildQueries({ term: "box", product: "jeans", area: "europa" });
    expect(q.length).toBeGreaterThan(3);
    expect(q.length).toBeLessThanOrEqual(6);
    expect(q.every((x) => x.includes("box"))).toBe(true);
  });
  it("un Paese: query locale + variante inglese", () => {
    const q = buildQueries({ term: "", product: "felpe", area: "DE" });
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
