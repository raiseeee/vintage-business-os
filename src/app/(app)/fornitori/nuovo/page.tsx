import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { createSupplier } from "../actions";
import { SupplierForm } from "../SupplierForm";

export const metadata = { title: "Nuovo fornitore · Vintage Business OS" };

export default function NuovoFornitorePage() {
  return (
    <>
      <Link href="/fornitori" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">
        ← Tutti i fornitori
      </Link>
      <PageHeader
        title="Nuovo fornitore"
        description="Registra solo ciò che sai. Fonti, prove e valutazione si aggiungono nella scheda dopo il salvataggio."
      />
      <div className="max-w-3xl rounded-lg border border-stone-200 bg-white p-5">
        <SupplierForm action={createSupplier} submitLabel="Crea fornitore" />
      </div>
    </>
  );
}
