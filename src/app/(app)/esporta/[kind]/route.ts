import { buildCsv, EXPORT_KINDS, type ExportKind } from "@/lib/business/export";
import { getBusinessData } from "@/lib/business/queries";
import { todayIso } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: RouteContext<"/esporta/[kind]">) {
  const { kind } = await ctx.params;
  if (!EXPORT_KINDS.includes(kind as ExportKind)) {
    return new Response("Esportazione non trovata", { status: 404 });
  }

  // Oltre al proxy, controllo esplicito: i dati escono solo per un utente autenticato.
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return new Response("Non autenticato", { status: 401 });

  const data = await getBusinessData();
  const csv = buildCsv(kind as ExportKind, data);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="vintage-${kind}-${todayIso()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
