"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, parseForm, validId, type FormState } from "@/lib/form-action";
import { createClient } from "@/lib/supabase/server";
import { getMembership, isMissingFunction } from "@/lib/team/membership";

const NOT_OWNER = "Solo un titolare può gestire i collaboratori.";

const inviteSchema = z.object({
  email: z.email("Inserisci un indirizzo email valido"),
  role: z.enum(["collaborator", "owner"]),
  days: z.coerce.number().int().min(1, "La scadenza va da 1 a 30 giorni").max(30, "La scadenza va da 1 a 30 giorni"),
});

async function requireOwnerMembership() {
  const m = await getMembership();
  if (!m || m.legacy || m.role !== "owner") return null;
  return m;
}

function teamError(error: { code?: string; message?: string }): string {
  if (isMissingFunction(error)) return "Applica prima la migrazione «attività condivisa» al database (vedi README).";
  // I messaggi delle nostre funzioni sono in italiano e sicuri da mostrare.
  if (["42501", "23505", "22023", "P0002"].includes(error.code ?? "") && error.message) return error.message;
  return "Operazione non riuscita. Riprova.";
}

/** Indirizzo pubblico dell'app, ricavato dalla richiesta (nessuna variabile d'ambiente in più). */
async function appOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function inviteMember(_prev: FormState, formData: FormData): Promise<FormState> {
  if (!(await requireOwnerMembership())) return fail(NOT_OWNER);
  const parsed = parseForm(inviteSchema, formData);
  if (!parsed.ok) return fail(parsed.error, formData);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_invite", {
    p_email: parsed.data.email,
    p_role: parsed.data.role,
    p_valid_days: parsed.data.days,
  });
  if (error) return fail(teamError(error), formData);

  const row = Array.isArray(data) ? data[0] : null;
  if (!row?.token) return fail("Operazione non riuscita. Riprova.", formData);

  revalidatePath("/collaboratori");
  return {
    error: null,
    ok: true,
    message: `Invito creato. Copia questo link e invialo a ${parsed.data.email}: lo vedi solo ora.\n${await appOrigin()}/invito/${row.token}`,
  };
}

export async function revokeInvite(inviteId: string): Promise<FormState> {
  if (!(await requireOwnerMembership())) return fail(NOT_OWNER);
  if (!validId(inviteId)) return fail("Invito non valido");
  const supabase = await createClient();
  const { error } = await supabase.rpc("revoke_invite", { p_invite_id: inviteId });
  if (error) return fail(teamError(error));
  revalidatePath("/collaboratori");
  return { error: null, ok: true };
}

export async function removeMember(userId: string): Promise<FormState> {
  if (!(await requireOwnerMembership())) return fail(NOT_OWNER);
  if (!validId(userId)) return fail("Utente non valido");
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_user_id: userId });
  if (error) return fail(teamError(error));
  revalidatePath("/collaboratori");
  return { error: null, ok: true };
}

export async function promoteMember(userId: string): Promise<FormState> {
  if (!(await requireOwnerMembership())) return fail(NOT_OWNER);
  if (!validId(userId)) return fail("Utente non valido");
  const supabase = await createClient();
  const { error } = await supabase.rpc("promote_member", { p_user_id: userId });
  if (error) return fail(teamError(error));
  revalidatePath("/collaboratori");
  return { error: null, ok: true };
}
