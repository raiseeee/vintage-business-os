import { z } from "zod";

const supabaseEnvSchema = z.object({
  url: z.url(),
  publishableKey: z.string().min(1),
});

export type SupabaseEnv = z.infer<typeof supabaseEnvSchema>;

/**
 * Legge e valida la configurazione pubblica di Supabase.
 * Restituisce null se manca o non è valida, così l'app può mostrare le istruzioni
 * di configurazione invece di andare in errore.
 *
 * Le variabili NEXT_PUBLIC_* vanno lette con il nome completo (non in modo
 * dinamico) perché Next le sostituisca al momento della build.
 * La chiave "publishable" (o la "anon key" legacy) è pensata per essere pubblica:
 * la sicurezza dei dati è affidata alle policy RLS, non al segreto della chiave.
 * Nessuna chiave segreta (service role) è usata o necessaria in questa milestone.
 */
export function getSupabaseEnv(): SupabaseEnv | null {
  const parsed = supabaseEnvSchema.safeParse({
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    publishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  });
  return parsed.success ? parsed.data : null;
}
