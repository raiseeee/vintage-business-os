import { describe, expect, it } from "vitest";
import { SCORE_WEIGHTS, computeScore, type Evaluation } from "./score";

const max: Evaluation = {
  proximity: 5,
  transparency: 5,
  min_order: 5,
  budget_fit: 5,
  vintage_interest: 5,
};

describe("pesi", () => {
  it("sommano a 100", () => {
    const sum = Object.values(SCORE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBe(100);
  });
});

describe("computeScore", () => {
  it("un raccoglitore diretto con tutti 5 prende 100", () => {
    expect(computeScore(max, "raccoglitore_diretto").total).toBe(100);
  });

  it("tutti 0 danno 0", () => {
    const zero: Evaluation = { proximity: 0, transparency: 0, min_order: 0, budget_fit: 0, vintage_interest: 0 };
    expect(computeScore(zero, "raccoglitore_diretto").total).toBe(0);
  });

  it("ogni criterio contribuisce in proporzione al suo peso", () => {
    const onlyTransparency: Evaluation = { proximity: 0, transparency: 5, min_order: 0, budget_fit: 0, vintage_interest: 0 };
    expect(computeScore(onlyTransparency, "rivenditore").total).toBe(25);
  });

  it("limita la vicinanza per un'origine non verificata (tetto 2)", () => {
    const r = computeScore(max, "origine_non_verificata");
    const prox = r.criteria.find((c) => c.key === "proximity")!;
    expect(prox.raw).toBe(5);
    expect(prox.effective).toBe(2);
    // 100 - (5-2)/5 * 30 = 82
    expect(r.total).toBe(82);
    expect(r.notes).toHaveLength(1);
  });

  it("non aggiunge note se il voto rispetta il tetto", () => {
    const r = computeScore({ ...max, proximity: 2 }, "origine_non_verificata");
    expect(r.notes).toHaveLength(0);
  });

  it("il totale è la somma dei punti dei criteri, arrotondata", () => {
    const e: Evaluation = { proximity: 3, transparency: 4, min_order: 3, budget_fit: 4, vintage_interest: 4 };
    const r = computeScore(e, "grossista_documentato");
    const sum = r.criteria.reduce((s, c) => s + c.points, 0);
    expect(r.total).toBe(Math.round(sum));
    // 18 + 20 + 9 + 12 + 12 = 71
    expect(r.total).toBe(71);
  });
});
