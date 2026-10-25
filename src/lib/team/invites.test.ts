import { describe, expect, it } from "vitest";
import { inviteStatus, isInviteToken } from "./invites";

const now = new Date("2026-10-25T12:00:00Z");
const future = "2026-10-30T12:00:00Z";
const past = "2026-10-20T12:00:00Z";

describe("inviteStatus", () => {
  it("in attesa", () => expect(inviteStatus({ expires_at: future, accepted_at: null, revoked_at: null }, now)).toBe("in_attesa"));
  it("scaduto", () => expect(inviteStatus({ expires_at: past, accepted_at: null, revoked_at: null }, now)).toBe("scaduto"));
  it("accettato prevale sulla scadenza", () =>
    expect(inviteStatus({ expires_at: past, accepted_at: past, revoked_at: null }, now)).toBe("accettato"));
  it("revocato prevale sulla scadenza", () =>
    expect(inviteStatus({ expires_at: past, accepted_at: null, revoked_at: past }, now)).toBe("revocato"));
});

describe("isInviteToken", () => {
  it("accetta 64 caratteri esadecimali", () => expect(isInviteToken("a".repeat(64))).toBe(true));
  it("rifiuta altro", () => {
    for (const v of ["", "abc", "A".repeat(64), "g".repeat(64), "a".repeat(63), "../../etc"]) expect(isInviteToken(v)).toBe(false);
  });
});
