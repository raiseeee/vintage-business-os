import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("accetta percorsi interni", () => {
    expect(safeNextPath("/invito/abc")).toBe("/invito/abc");
    expect(safeNextPath("/capi?stato=pronto")).toBe("/capi?stato=pronto");
  });
  it("rifiuta indirizzi esterni e trucchi", () => {
    for (const bad of ["https://evil.com", "//evil.com", "/\\evil.com", "evil", "", null, undefined, "/x\n/y", "/login"]) {
      expect(safeNextPath(bad as string | null | undefined)).toBe("/dashboard");
    }
  });
  it("usa il valore di ripiego indicato", () => {
    expect(safeNextPath("//x", "/home")).toBe("/home");
  });
});
