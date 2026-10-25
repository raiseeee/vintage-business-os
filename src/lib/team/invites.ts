export type InviteStatus = "in_attesa" | "accettato" | "revocato" | "scaduto";

export const INVITE_STATUS_LABELS: Record<InviteStatus, string> = {
  in_attesa: "In attesa",
  accettato: "Accettato",
  revocato: "Revocato",
  scaduto: "Scaduto",
};

export type InviteRow = {
  expires_at: string;
  accepted_at: string | null;
  revoked_at: string | null;
};

/** Stato di un invito: la scadenza conta solo se non è già stato accettato o revocato. */
export function inviteStatus(invite: InviteRow, now: Date = new Date()): InviteStatus {
  if (invite.accepted_at) return "accettato";
  if (invite.revoked_at) return "revocato";
  if (new Date(invite.expires_at).getTime() <= now.getTime()) return "scaduto";
  return "in_attesa";
}

/** Il codice dell'invito è 64 caratteri esadecimali. */
export function isInviteToken(value: string): boolean {
  return /^[0-9a-f]{64}$/.test(value);
}
