import { fetchAll } from "@/lib/business/paginate";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Tabelle dell'attività incluse nel backup (le foto: solo i percorsi, i file restano nello storage). */
const TABLES = [
  "suppliers",
  "supplier_sources",
  "supplier_claims",
  "supplier_evaluations",
  "contact_log",
  "purchase_lots",
  "items",
  "item_photos",
  "sales",
] as const;

/**
 * Copia di sicurezza di tutti i dati visibili all'utente, in un unico file JSON.
 * Serve da archivio e da controllo; NON è uno strumento di ripristino automatico
 * (per ripristinare si usa un dump del database, vedi README).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Non autenticato", { status: 401 });

  const tables: Record<string, unknown[]> = {};
  try {
    for (const table of TABLES) {
      tables[table] = await fetchAll<Record<string, unknown>>((from, to) =>
        supabase.from(table).select("*").order("id").range(from, to),
      );
    }
  } catch {
    return new Response("Backup non riuscito: riprova.", { status: 500 });
  }

  const counts = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, v.length]));
  const body = JSON.stringify(
    { app: "vintage-business-os", createdAt: new Date().toISOString(), counts, tables },
    null,
    2,
  );

  return new Response(body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="vintage-backup-${todayIso()}.json"`,
      "Cache-Control": "no-store",
    },
  });
}
