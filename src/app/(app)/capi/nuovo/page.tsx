import Link from "next/link";
import { PageHeader } from "@/components/PagePlaceholder";
import { getBusinessData } from "@/lib/business/queries";
import { createItem } from "../actions";
import { ItemForm } from "../ItemForm";

export const metadata = { title: "Nuovo capo · Vintage Business OS" };

export default async function NuovoCapoPage(props: PageProps<"/capi/nuovo">) {
  const params = await props.searchParams;
  const lotParam = Array.isArray(params.lotto) ? params.lotto[0] : params.lotto;

  const { lots, items } = await getBusinessData();
  const sortedLots = [...lots].sort((a, b) => b.purchased_at.localeCompare(a.purchased_at));
  const selected = sortedLots.find((l) => l.id === lotParam) ?? sortedLots[0];

  // Codice suggerito: <codice lotto>-<numero successivo> (modificabile).
  let suggested = "";
  if (selected) {
    const prefix = `${selected.code}-`;
    const used = items
      .filter((i) => i.lot_id === selected.id && i.code.startsWith(prefix))
      .map((i) => Number(i.code.slice(prefix.length)))
      .filter(Number.isFinite);
    suggested = `${prefix}${String(Math.max(0, ...used) + 1).padStart(3, "0")}`;
  }

  return (
    <>
      <Link href="/capi" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">
        ← Tutti i capi
      </Link>
      <PageHeader title="Nuovo capo" description="Le foto si aggiungono nella scheda, dopo il salvataggio." />

      {sortedLots.length === 0 ? (
        <div className="max-w-xl rounded-lg border border-dashed border-stone-300 bg-white p-6 text-sm text-stone-700">
          Ogni capo appartiene a un lotto.{" "}
          <Link href="/lotti/nuovo" className="font-medium text-stone-900 underline">
            Registra prima un lotto
          </Link>
          .
        </div>
      ) : (
        <div className="max-w-3xl rounded-lg border border-stone-200 bg-white p-5">
          <ItemForm
            action={createItem}
            lots={sortedLots}
            defaults={{ lotId: selected?.id, code: suggested }}
            submitLabel="Crea capo"
          />
        </div>
      )}
    </>
  );
}
