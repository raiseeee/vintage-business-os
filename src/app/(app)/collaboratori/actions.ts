"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { fail, parseForm, validId, type FormState } from "@/lib/form-action";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { newAccountSchema } from "@/lib/team/accounts";
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

/**
 * Crea direttamente un account (email + password) e lo aggiunge all'attività.
 * Usa la chiave di servizio, quindi prima si verifica che chi chiama sia titolare.
 */
export async function createMemberAccount(_prev: FormState, formData: FormData): Promise<FormState> {
  const owner = await requireOwnerMembership();
  if (!owner) return fail(NOT_OWNER);

  const parsed = parseForm(newAccountSchema, formData);
  if (!parsed.ok) return fail(parsed.error); // la password non viene rimandata al browser
  const { email, password, role } = parsed.data;

  const admin = createAdminClient();
  if (!admin) {
    return fail("Manca la chiave di servizio sul server (SUPABASE_SERVICE_ROLE_KEY): vedi il README, sezione «Creare account dall'app».");
  }

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    const exists = createError?.code === "email_exists" || /already|registered/i.test(createError?.message ?? "");
    return fail(
      exists
        ? "Esiste già un account con questa email: usa «Invita una persona» qui sotto."
        : "Account non creato. Controlla email e password e riprova.",
    );
  }

  const { error: memberError } = await admin
    .from("business_members")
    .insert({ business_id: owner.businessId, user_id: created.user.id, role });
  if (memberError) {
    // Niente account orfani: se l'aggiunta fallisce, l'account appena creato viene tolto.
    await admin.auth.admin.deleteUser(created.user.id);
    return fail("Account non creato: non è stato possibile aggiungerlo all'attività.");
  }

  revalidatePath("/collaboratori");
  return {
    error: null,
    ok: true,
    message: `Account creato per ${email}. Comunicagli la password di persona: l'app non la mostra più.`,
  };
}
