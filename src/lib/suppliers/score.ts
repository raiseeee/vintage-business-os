import type { SupplierType } from "./constants";

/**
 * Punteggio trasparente di un fornitore: 0-100.
 *
 * Ogni criterio vale da 0 a 5 e pesa una percentuale fissa (la somma dei pesi è 100).
 * Punti del criterio = peso × (valore / 5). Il totale è la somma dei punti.
 *
 * Regola anti-gonfiaggio: il voto di "vicinanza alla fonte" non può superare
 * il massimo consentito dal TIPO del fornitore. Un'origine non verificata non
 * può quindi ottenere un punteggio di vicinanza alto solo per come l'ho giudicata.
 * Il tipo "diretto" è a sua volta bloccato dal database senza prova documentata.
 */

export const SCORE_WEIGHTS = {
  proximity: 30,
  transparency: 25,
  min_order: 15,
  budget_fit: 15,
  vintage_interest: 15,
} as const;

export type ScoreKey = keyof typeof SCORE_WEIGHTS;

export const SCORE_LABELS: Record<ScoreKey, string> = {
  proximity: "Vicinanza alla fonte",
  transparency: "Trasparenza",
  min_order: "Ordine minimo accessibile",
  budget_fit: "Compatibilità con il budget",
  vintage_interest: "Interesse per il vintage sportswear",
};

export const SCORE_HINTS: Record<ScoreKey, string> = {
  proximity: "5 = raccoglie o seleziona alla fonte, 0 = molti intermediari.",
  transparency: "5 = fonti, prezzi e provenienza chiari e verificabili.",
  min_order: "5 = ordine minimo molto basso, 0 = fuori portata.",
  budget_fit: "5 = prezzi pienamente compatibili col tuo budget.",
  vintage_interest: "5 = stock ricco di vintage/sportswear che ti interessa.",
};

/** Massimo voto di vicinanza ammesso per ciascun tipo di fornitore. */
export const PROXIMITY_CAP_BY_TYPE: Record<SupplierType, number> = {
  raccoglitore_diretto: 5,
  centro_selezione: 4,
  grossista_documentato: 3,
  rivenditore: 2,
  origine_non_verificata: 2,
};

export interface Evaluation {
  proximity: number;
  transparency: number;
  min_order: number;
  budget_fit: number;
  vintage_interest: number;
}

export interface ScoreCriterion {
  key: ScoreKey;
  label: string;
  weight: number;
  /** Voto inserito (0-5). */
  raw: number;
  /** Voto usato nel calcolo, dopo gli eventuali tetti. */
  effective: number;
  points: number;
}

export interface ScoreResult {
  /** 0-100, arrotondato all'intero. */
  total: number;
  criteria: ScoreCriterion[];
  notes: string[];
}

export function computeScore(
  evaluation: Evaluation,
  supplierType: SupplierType,
): ScoreResult {
  const notes: string[] = [];
  const criteria = (Object.keys(SCORE_WEIGHTS) as ScoreKey[]).map((key) => {
    const raw = evaluation[key];
    let effective = raw;

    if (key === "proximity") {
      const cap = PROXIMITY_CAP_BY_TYPE[supplierType];
      if (raw > cap) {
        effective = cap;
        notes.push(
          `La vicinanza è limitata a ${cap}/5 perché il fornitore è di tipo «${supplierType.replaceAll("_", " ")}» (voto inserito: ${raw}).`,
        );
      }
    }

    const weight = SCORE_WEIGHTS[key];
    return {
      key,
      label: SCORE_LABELS[key],
      weight,
      raw,
      effective,
      points: (weight * effective) / 5,
    };
  });

  const total = Math.round(criteria.reduce((sum, c) => sum + c.points, 0));
  return { total, criteria, notes };
}
