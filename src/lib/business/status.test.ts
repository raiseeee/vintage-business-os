import { describe, expect, it } from "vitest";
import { statusAfterPhoto, statusForRequest } from "./status";

describe("statusForRequest", () => {
  it("senza foto, pronto e pubblicato diventano da fotografare", () => {
    expect(statusForRequest("pronto", 0)).toEqual({ status: "da_fotografare", adjusted: true });
    expect(statusForRequest("pubblicato", 0)).toEqual({ status: "da_fotografare", adjusted: true });
  });
  it("con foto lo stato richiesto resta", () => {
    expect(statusForRequest("pronto", 1)).toEqual({ status: "pronto", adjusted: false });
    expect(statusForRequest("pubblicato", 3)).toEqual({ status: "pubblicato", adjusted: false });
  });
  it("gli altri stati non dipendono dalle foto", () => {
    for (const s of ["da_controllare", "da_fotografare", "reso"] as const) {
      expect(statusForRequest(s, 0)).toEqual({ status: s, adjusted: false });
    }
  });
});

describe("statusAfterPhoto", () => {
  it("da controllare e da fotografare passano a pronto", () => {
    expect(statusAfterPhoto("da_fotografare")).toBe("pronto");
    expect(statusAfterPhoto("da_controllare")).toBe("pronto");
  });
  it("gli altri stati non cambiano", () => {
    for (const s of ["pronto", "pubblicato", "venduto", "reso"] as const) expect(statusAfterPhoto(s)).toBeNull();
  });
});
