import Link from "next/link";
import { ModalButton } from "@/components/Modal";
import { PageHeader } from "@/components/PagePlaceholder";
import { Section, formatDate } from "@/components/ui";
import { getBusinessData } from "@/lib/business/queries";
import { formatEuro } from "@/lib/metrics";
import { getSuppliers } from "@/lib/suppliers/queries";
import { createSupplier } from "./actions";
import { SupplierForm } from "./SupplierForm";

export const metadata = { title: "Fornitori · ARCHVNT" };

export default async function FornitoriPage() {
  const { rows, available } = await getSuppliers();

  if (!available) {
    return (
      <>
        <PageHeader title="Fornitori" description="Da chi compri i lotti." />
        <p className="rounded-md border border-stone-300 bg-stone-100 p-4 text-sm text-stone-900">
          Il database non ha ancora la tabella dei fornitori. Applica la migrazione{" "}
          <code className="rounded bg-white px-2">20261030000001_suppliers_simple.sql</code> dallo SQL Editor di Supabase (istruzioni nel README).
        </p>
      </>
    );
  }

  const { lots } = await getBusinessData();
  const stats = new Map<string, { count: number; spent: number; last: string | null }>();
  for (const l of lots) {
    if (!l.supplier_id) continue;
    const s = stats.get(l.supplier_id) ?? { count: 0, spent: 0, last: null };
    s.count += 1;
    s.spent += l.purchase_cost_cents + l.inbound_shipping_cents + l.other_costs_cents;
    if (!s.last || l.purchased_at > s.last) s.last = l.purchased_at;
    stats.set(l.supplier_id, s);
  }

  return (
    <>
      <PageHeader
        title="Fornitori"
        description="Da chi compri i lotti, con i contatti e lo storico degli acquisti."
        actions={
          <ModalButton label="Nuovo fornitore" title="Nuovo fornitore">
            <SupplierForm action={createSupplier} submitLabel="Aggiungi" />
          </ModalButton>
        }
      />

      <Section title="I tuoi fornitori">
        {rows.length === 0 ? (
          <p className="text-sm text-stone-600">Nessun fornitore. Aggiungine uno, poi collegalo ai lotti dalla loro pagina.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="border-b border-stone-200 text-xs text-stone-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Fornitore</th>
                  <th className="py-2 pr-4 font-semibold">Contatti</th>
                  <th className="py-2 pr-4 text-right font-semibold">Lotti</th>
                  <th className="py-2 pr-4 text-right font-semibold">Speso</th>
                  <th className="py-2 font-semibold">Ultimo acquisto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((s) => {
                  const st = stats.get(s.id);
                  return (
                    <tr key={s.id}>
                      <td className="py-4 pr-4">
                        <Link href={`/fornitori/${s.id}`} className="font-semibold text-stone-900 hover:underline">{s.name}</Link>
                      </td>
                      <td className="py-4 pr-4 text-stone-600">
                        {[s.email, s.phone].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="py-4 pr-4 text-right tabular-nums">{st?.count ?? 0}</td>
                      <td className="py-4 pr-4 text-right tabular-nums">{formatEuro(st?.spent ?? 0)}</td>
                      <td className="py-4 text-stone-600">{st?.last ? formatDate(st.last) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </>
  );
}
