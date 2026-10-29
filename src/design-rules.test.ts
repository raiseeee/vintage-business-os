import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Regole del design, controllate sul codice: se una modifica le rompe, il test dice dove.
 * 1. spaziature a multipli di 8 px  2. una sola palette neutra, niente gradienti né ombre
 * 3. icone a linea da una sola libreria  4. due pesi per font, mai maiuscolo
 */
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const root = join(__dirname);
const tsx = walk(root).filter((f) => f.endsWith(".tsx") && !f.includes(".test."));
const read = (f: string) => readFileSync(f, "utf8");

function findAll(re: RegExp, files = tsx): string[] {
  const hits: string[] = [];
  for (const f of files) {
    read(f).split("\n").forEach((line, i) => {
      for (const m of line.matchAll(re)) hits.push(`${f.replace(root, "src")}:${i + 1} ${m[0]}`);
    });
  }
  return hits;
}

describe("1. spaziature a multipli di 8", () => {
  const PREFIX = "(?:p|px|py|pt|pb|pl|pr|ps|pe|m|mx|my|mt|mb|ml|mr|ms|me|gap|gap-x|gap-y|space-x|space-y|inset|inset-x|inset-y|top|bottom|left|right|h|w|size|min-h|min-w)";
  it("le classi Tailwind di spazio hanno un numero pari (1 unità = 4 px)", () => {
    const re = new RegExp(`(?<![\\w-])-?${PREFIX}-(\\d+(?:\\.5)?)(?![\\w./\\[])`, "g");
    const odd = findAll(re).filter((h) => {
      const n = Number(h.match(/-(\d+(?:\.5)?)$/)![1]);
      return n % 2 !== 0;
    });
    expect(odd).toEqual([]);
  });
  it("i valori in pixel tra parentesi quadre sono multipli di 8", () => {
    const bad = findAll(/\[(\d+)px\]/g).filter((h) => Number(h.match(/\[(\d+)px\]/)![1]) % 8 !== 0);
    expect(bad).toEqual([]);
  });
});

describe("2. una sola palette neutra, niente gradienti né ombre", () => {
  it("nessun colore fuori dalla scala neutra", () => {
    const re = /(?:bg|text|border|ring|divide|fill|stroke|outline|from|to|via)-(?:red|green|amber|indigo|blue|yellow|orange|sky|emerald|rose|lime|teal|violet|purple|pink|cyan|fuchsia|accent)\b[\w/-]*/g;
    expect(findAll(re)).toEqual([]);
  });
  it("nessun colore esadecimale nei componenti (stanno solo nella palette di globals.css)", () => {
    expect(findAll(/#[0-9a-fA-F]{3,8}\b/g)).toEqual([]);
  });
  it("nessun gradiente, ombra o bagliore", () => {
    expect(findAll(/\b(?:shadow|bg-gradient|bg-linear|drop-shadow|blur|backdrop-blur)[\w-]*/g)).toEqual([]);
    const css = read(join(root, "app/globals.css"));
    expect(css).not.toMatch(/gradient|box-shadow|text-shadow|drop-shadow|blur\(/);
  });
});

describe("3. icone a linea da una sola libreria", () => {
  it("nessun emoji, freccia o simbolo decorativo nei testi", () => {
    const re = /[←-⇿⌀-⏿☀-➿⬀-⯿\u{1F000}-\u{1FAFF}]/gu;
    expect(findAll(re)).toEqual([]);
  });
  it("le icone vengono solo da lucide-react", () => {
    const pkg = JSON.parse(readFileSync(join(root, "../package.json"), "utf8"));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /icons|heroicons|fontawesome|phosphor|tabler|feather/.test(d))).toEqual([]);
    const other = findAll(/from "(?:react-icons|@heroicons|@fortawesome|@phosphor|@tabler)[^"]*"/g);
    expect(other).toEqual([]);
  });
});

describe("4. due pesi per font, mai maiuscolo", () => {
  it("solo font-normal e font-semibold", () => {
    expect(findAll(/\bfont-(?:thin|extralight|light|medium|bold|extrabold|black)\b/g)).toEqual([]);
  });
  it("nessun maiuscolo forzato", () => {
    expect(findAll(/\b(?:uppercase|capitalize)\b/g)).toEqual([]);
    expect(read(join(root, "app/globals.css"))).not.toMatch(/text-transform:\s*(?:uppercase|capitalize)/);
  });
  it("in globals.css i pesi usati sono 400 e 600", () => {
    const css = read(join(root, "app/globals.css"));
    const weights = new Set([...css.matchAll(/font-weight:\s*(\d+)/g)].map((m) => m[1]));
    expect([...weights].sort()).toEqual(["400", "600"]);
  });
});
