import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { getLotCount, getSupplierNames } from "@/lib/business/queries";
import { todayIso } from "@/lib/dates";
import { createLot } from "../actions";
import { LotForm } from "../LotForm";

export const metadata = { title: "Nuovo lotto · Vintage Business OS" };

export default async function NuovoLottoPage(props: PageProps<"/lotti/nuovo">) {
  const params = await props.searchParams;
  const preselected = Array.isArray(params.fornitore) ? params.fornitore[0] : params.fornitore;

  const [suppliers, lotCount] = await Promise.all([getSupplierNames(), getLotCount()]);

  return (
    <>
      <Link href="/lotti" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">
        ← Tutti i lotti
      </Link>
      <PageHeader
        title="Nuovo lotto"
        description="Registra un acquisto. I costi del lotto si ripartiscono sui capi; quelli di vendita si inseriscono sul singolo capo."
      />

      {suppliers.length === 0 ? (
        <div className="max-w-xl rounded-lg border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-700">
          Per registrare un lotto serve almeno un fornitore.{" "}
          <Link href="/fornitori/nuovo" className="font-medium text-stone-900 underline">
            Aggiungine uno
          </Link>
          .
        </div>
      ) : (
        <div className="max-w-3xl rounded-lg border border-stone-200 bg-white p-5">
          <LotForm
            action={createLot}
            suppliers={suppliers}
            defaults={{
              code: `L-${String(lotCount + 1).padStart(3, "0")}`,
              supplierId: preselected,
              purchasedAt: todayIso(),
            }}
            submitLabel="Crea lotto"
          />
        </div>
      )}
    </>
  );
}
