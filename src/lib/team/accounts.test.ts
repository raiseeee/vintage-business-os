import { describe, expect, it } from "vitest";
import { newAccountSchema } from "./accounts";

describe("newAccountSchema", () => {
  const ok = { email: " Mario@Esempio.IT ", password: "una-password-lunga", role: "collaborator" };
  it("normalizza l'email", () => {
    expect(newAccountSchema.parse(ok).email).toBe("mario@esempio.it");
  });
  it("rifiuta password corte o troppo lunghe e ruoli strani", () => {
    expect(newAccountSchema.safeParse({ ...ok, password: "corta" }).success).toBe(false);
    expect(newAccountSchema.safeParse({ ...ok, password: "x".repeat(73) }).success).toBe(false);
    expect(newAccountSchema.safeParse({ ...ok, role: "admin" }).success).toBe(false);
    expect(newAccountSchema.safeParse({ ...ok, email: "non-una-email" }).success).toBe(false);
  });
});
