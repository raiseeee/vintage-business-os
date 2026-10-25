"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/team/next-path";

const credentialsSchema = z.object({
  email: z.email("Inserisci un indirizzo email valido"),
  password: z.string().min(1, "Inserisci la password"),
});

export type LoginState = { error: string | null };

export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dati non validi" };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    // Messaggio volutamente generico: non rivela se l'email esiste.
    return { error: "Email o password non corretti" };
  }

  const next = formData.get("next");
  redirect(safeNextPath(typeof next === "string" ? next : null));
}
