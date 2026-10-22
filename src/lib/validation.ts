import { z } from "zod";
import { parseEuroToCents } from "@/lib/money";

/** Stringa dal form: vuota → null. */
export const optionalText = z
  .string()
  .trim()
  .max(2000, "Testo troppo lungo")
  .transform((s) => (s === "" ? null : s));

/** Solo http(s): questi valori diventano link, quindi niente "javascript:" e simili. */
export const optionalUrl = z
  .string()
  .trim()
  .max(500, "Indirizzo troppo lungo")
  .transform((s, ctx) => {
    if (s === "") return null;
    try {
      const url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`);
      if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error();
      return url.toString();
    } catch {
      ctx.addIssue({ code: "custom", message: "Indirizzo web non valido" });
      return z.NEVER;
    }
  });

const EURO_ERROR = "Importo non valido (usa la virgola per i decimali, es. 12,50)";

/** Importo in euro → centesimi; vuoto → null. */
export const optionalEuro = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const cents = parseEuroToCents(s);
    if (cents === undefined) {
      ctx.addIssue({ code: "custom", message: EURO_ERROR });
      return z.NEVER;
    }
    return cents;
  });

/** Importo in euro obbligatorio (zero ammesso) → centesimi. */
export const requiredEuro = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") {
      ctx.addIssue({ code: "custom", message: "L'importo è obbligatorio" });
      return z.NEVER;
    }
    const cents = parseEuroToCents(s);
    if (cents === undefined) {
      ctx.addIssue({ code: "custom", message: EURO_ERROR });
      return z.NEVER;
    }
    return cents;
  });

/** Importo in euro facoltativo: vuoto vale 0 (per costi che possono mancare). */
export const euroOrZero = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return 0;
    const cents = parseEuroToCents(s);
    if (cents === undefined) {
      ctx.addIssue({ code: "custom", message: EURO_ERROR });
      return z.NEVER;
    }
    return cents;
  });

export const optionalInt = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    if (!/^\d{1,9}$/.test(s)) {
      ctx.addIssue({ code: "custom", message: "Inserisci un numero intero" });
      return z.NEVER;
    }
    return Number(s);
  });

/** Intero maggiore di zero, obbligatorio. */
export const positiveInt = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (!/^\d{1,9}$/.test(s) || Number(s) < 1) {
      ctx.addIssue({ code: "custom", message: "Inserisci un numero intero maggiore di zero" });
      return z.NEVER;
    }
    return Number(s);
  });

export const optionalDecimal = z
  .string()
  .trim()
  .transform((s, ctx) => {
    if (s === "") return null;
    const n = Number(s.replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 99_999_999) {
      ctx.addIssue({ code: "custom", message: "Inserisci un numero valido" });
      return z.NEVER;
    }
    return Math.round(n * 100) / 100;
  });

/** Data AAAA-MM-GG obbligatoria (quella dei campi <input type="date">). */
export const requiredDate = z
  .string()
  .trim()
  .transform((s, ctx) => {
    const valid =
      /^\d{4}-\d{2}-\d{2}$/.test(s) &&
      new Date(`${s}T00:00:00Z`).toISOString().slice(0, 10) === s;
    if (!valid) {
      ctx.addIssue({ code: "custom", message: "Data non valida" });
      return z.NEVER;
    }
    return s;
  });

/** Codice identificativo (lotto o capo): visibile, senza caratteri strani, max 40. */
export const codeField = z
  .string()
  .trim()
  .min(1, "Il codice è obbligatorio")
  .max(40, "Codice troppo lungo (max 40 caratteri)")
  .regex(/^[A-Za-z0-9][A-Za-z0-9._\-/ ]*$/, "Usa solo lettere, numeri e . _ - /");

/** Testo breve facoltativo (marca, categoria, taglia…). */
export const shortText = z
  .string()
  .trim()
  .max(100, "Testo troppo lungo (max 100 caratteri)")
  .transform((s) => (s === "" ? null : s));
