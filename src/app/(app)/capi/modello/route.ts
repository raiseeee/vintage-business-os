import { IMPORT_TEMPLATE_HEADER } from "@/lib/business/import";
import { toCsv } from "@/lib/csv";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Modello CSV vuoto (solo l'intestazione) per l'importazione dei capi. */
export async function GET() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Non autenticato", { status: 401 });

  return new Response(toCsv(IMPORT_TEMPLATE_HEADER, []), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="modello-importazione-capi.csv"',
      "Cache-Control": "no-store",
    },
  });
}
