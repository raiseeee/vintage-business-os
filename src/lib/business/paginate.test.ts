import { describe, expect, it } from "vitest";
import { fetchAll } from "./paginate";

/** Simula una tabella e un server che restituisce al massimo `maxRows` righe per richiesta. */
function fakeTable(total: number, maxRows: number) {
  const rows = Array.from({ length: total }, (_, i) => i);
  let calls = 0;
  return {
    get calls() {
      return calls;
    },
    page: async (from: number, to: number) => {
      calls += 1;
      return { data: rows.slice(from, Math.min(to + 1, from + maxRows)), error: null };
    },
  };
}

describe("fetchAll", () => {
  it("legge più di 1000 righe (il limite di una singola richiesta)", async () => {
    const t = fakeTable(2500, 1000);
    const all = await fetchAll(t.page);
    expect(all).toHaveLength(2500);
    expect(all[0]).toBe(0);
    expect(all[2499]).toBe(2499);
  });

  it("non perde righe se il server ne restituisce meno del richiesto", async () => {
    const t = fakeTable(1234, 500);
    const all = await fetchAll(t.page);
    expect(all).toHaveLength(1234);
    expect(new Set(all).size).toBe(1234); // nessun duplicato
  });

  it("tabella vuota: una sola richiesta, nessuna riga", async () => {
    const t = fakeTable(0, 1000);
    expect(await fetchAll(t.page)).toEqual([]);
    expect(t.calls).toBe(1);
  });

  it("lancia un errore se una pagina fallisce, invece di restituire dati parziali", async () => {
    let n = 0;
    await expect(
      fetchAll(async () => (++n === 2 ? { data: null, error: new Error("x") } : { data: [1, 2, 3], error: null })),
    ).rejects.toThrow("Impossibile caricare i dati");
  });
});
