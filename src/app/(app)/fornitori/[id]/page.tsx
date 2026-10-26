import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/form";
import { PageHeader } from "@/components/PagePlaceholder";
import { Section, formatDate } from "@/components/ui";
import { getBusinessData } from "@/lib/business/queries";
import { formatEuro } from "@/lib/metrics";
import { getSupplier } from "@/lib/suppliers/queries";
import { getMembership } from "@/lib/team/membership";
import { uuidSchema } from "@/lib/validation";
import { deleteSupplier, updateSupplier } from "../actions";
import { SupplierForm } from "../SupplierForm";

export const metadata = { title: "Fornitore · Vintage Business OS" };

export default async function FornitoreDetailPage(props: PageProps<"/fornitori/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();
  const supplier = await getSupplier(id);
  if (!supplier) notFound();

  const canDelete = (await getMembership())?.role === "owner";
  const { lots, items } = await getBusinessData();
  const own = lots.filter((l) => l.supplier_id === id).sort((a, b) => b.purchased_at.localeCompare(a.purchased_at));
  const total = own.reduce((s, l) => s + l.purchase_cost_cents + l.inbound_shipping_cents + l.other_costs_cents, 0);

  return (
    <>
      <Link href="/fornitori" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">← Fornitori</Link>
      <PageHeader title={supplier.name} description={[supplier.email, supplier.phone, supplier.address].filter(Boolean).join(" · ") || "Nessun contatto salvato."} />

      <div className="space-y-6">
        <Section title="Storico lotti" description={own.length > 0 ? `${own.length} lotti · ${formatEuro(total)} spesi in totale` : undefined}>
          {own.length === 0 ? (
            <p className="text-sm text-stone-600">Nessun lotto collegato. Collega un lotto dalla sua pagina (Modifica lotto → Fornitore).</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-sm">
                <thead className="border-b border-stone-200 text-xs uppercase tracking-wide text-stone-500">
                  <tr>
                    <th className="py-2 pr-4 font-medium">Lotto</th>
                    <th className="py-2 pr-4 font-medium">Data</th>
                    <th className="py-2 pr-4 text-right font-medium">Capi</th>
                    <th className="py-2 pr-4 text-right font-medium">Venduti</th>
                    <th className="py-2 text-right font-medium">Costo totale</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {own.map((l) => {
                    const mine = items.filter((i) => i.lot_id === l.id);
                    return (
                      <tr key={l.id}>
                        <td className="py-3 pr-4"><Link href={`/lotti/${l.id}`} className="font-medium text-stone-900 hover:underline">{l.code}</Link></td>
                        <td className="py-3 pr-4 text-stone-600">{formatDate(l.purchased_at)}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{l.quantity}</td>
                        <td className="py-3 pr-4 text-right tabular-nums">{mine.filter((i) => i.status === "venduto").length}</td>
                        <td className="py-3 text-right tabular-nums">{formatEuro(l.purchase_cost_cents + l.inbound_shipping_cents + l.other_costs_cents)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section title="Dati del fornitore">
          <SupplierForm action={updateSupplier.bind(null, id)} supplier={supplier} submitLabel="Salva modifiche" />
        </Section>

        {canDelete && (
          <Section title="Elimina fornitore">
            <p className="mb-3 text-sm text-stone-600">I suoi lotti restano, senza fornitore.</p>
            <ActionForm
              action={deleteSupplier.bind(null, id)}
              submitLabel="Elimina fornitore"
              pendingLabel="Eliminazione…"
              successMessage={null}
              variant="danger"
              confirm="Eliminare questo fornitore? I lotti restano."
            />
          </Section>
        )}
      </div>
    </>
  );
}
