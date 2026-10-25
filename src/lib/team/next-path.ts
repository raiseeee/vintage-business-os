/**
 * Percorso di ritorno dopo il login (per far sopravvivere i link d'invito).
 * Accetta solo percorsi interni: niente indirizzi esterni, niente «//host», niente backslash.
 */
export function safeNextPath(value: string | null | undefined, fallback = "/dashboard"): string {
  if (!value || value.length > 300) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.includes("\\")) return fallback;
  if (/[\u0000-\u001f]/.test(value)) return fallback;
  if (value === "/login" || value.startsWith("/login?")) return fallback;
  return value;
}
