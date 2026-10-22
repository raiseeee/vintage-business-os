import { describe, expect, it } from "vitest";
import { todayIso } from "./dates";

describe("todayIso", () => {
  it("usa il giorno italiano, non quello UTC", () => {
    // 23:30 UTC del 21 ottobre = 01:30 del 22 ottobre in Italia (ora legale)
    expect(todayIso(new Date("2026-10-21T23:30:00Z"))).toBe("2026-10-22");
  });
  it("ha il formato AAAA-MM-GG", () => {
    expect(todayIso(new Date("2026-01-05T12:00:00Z"))).toBe("2026-01-05");
  });
});
