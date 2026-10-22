import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, Field } from "@/components/form";
import { ItemStatusBadge, Section, Stat, Tag, formatDate, toneOf } from "@/components/ui";
import { CHANNEL_SUGGESTIONS } from "@/lib/business/constants";
import { toMetricItems, toMetricLot } from "@/lib/business/mappers";
import {
  getItem,
  getItemPhotos,
  getLot,
  getSaleForItem,
  getSupplierNames,
} from "@/lib/business/queries";
import { todayIso } from "@/lib/dates";
import { allocatedItemCost, formatEuro, itemProfit, saleNetRevenue } from "@/lib/metrics";
import { centsToInput } from "@/lib/money";
import { createClient } from "@/lib/supabase/server";
import { uuidSchema } from "@/lib/suppliers/schemas";
import { deleteItem, deletePhoto, markReturned, recordSale, undoSale, updateItem } from "../actions";
import { ItemForm } from "../ItemForm";
import { PhotoUploader } from "../PhotoUploader";

export const metadata = { title: "Capo · Vintage Business OS" };

export default async function CapoDetailPage(props: PageProps<"/capi/[id]">) {
  const { id } = await props.params;
  if (!uuidSchema.safeParse(id).success) notFound();

  const item = await getItem(id);
  if (!item) notFound();

  const supabase = await createClient();
  const [lot, sale, photos, suppliers, auth] = await Promise.all([
    getLot(item.lot_id),
    getSaleForItem(id),
    getItemPhotos(id),
    getSupplierNames(),
    supabase.auth.getUser(),
  ]);
  if (!lot || !auth.data.user) notFound();

  const supplier = suppliers.find((s) => s.id === lot.supplier_id);
  const metricLot = toMetricLot(lot);
  const [metricItem] = toMetricItems([item], sale ? [sale] : []);
  const profit = itemProfit(metricItem, metricLot);
  const unitCost = allocatedItemCost(metricLot);

  const isSold = item.status === "venduto";
  const isReturned = item.status === "reso";

  return (
    <>
      <Link href="/capi" className="mb-3 inline-block text-sm text-stone-600 hover:text-stone-900">
        ← Tutti i capi
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-stone-900">{item.code}</h1>
          <ItemStatusBadge status={item.status} />
          {item.is_demo && <Tag>DEMO</Tag>}
        </div>
        <p className="mt-1 text-sm text-stone-600">
          {[item.brand, item.category, item.size].filter(Boolean).join(" · ") || "Nessun dettaglio"}
          {" · lotto "}
          <Link href={`/lotti/${lot.id}`} className="underline underline-offset-2 hover:text-stone-900">{lot.code}</Link>
          {supplier && (
            <>
              {" · "}
              <Link href={`/fornitori/${supplier.id}`} className="underline underline-offset-2 hover:text-stone-900">{supplier.name}</Link>
            </>
          )}
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Costo attribuito" value={formatEuro(unitCost)} hint={`Costo del lotto diviso ${lot.quantity} capi`} />
        <Stat label="Prezzo previsto" value={item.expected_price_cents !== null ? formatEuro(item.expected_price_cents) : "—"} />
        <Stat
          label="Profitto"
          value={profit !== null ? formatEuro(profit) : "—"}
          tone={profit !== null ? toneOf(profit) : "neutral"}
          hint={profit !== null ? "Ricavo netto − costo attribuito" : "Disponibile dopo la vendita"}
        />
      </div>

      <div className="mt-5 space-y-5">
        <Section title="Foto" description="Le foto sono private: le vedi solo tu.">
          {photos.length === 0 ? (
            <p className="text-sm text-stone-500">Nessuna foto.</p>
          ) : (
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {photos.map((p) => (
                <li key={p.id}>
                  {p.url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.url} alt={`Foto di ${item.code}`} className="aspect-square w-full rounded-md object-cover" />
                  ) : (
                    <div className="flex aspect-square w-full items-center justify-center rounded-md bg-stone-100 text-xs text-stone-500">Non disponibile</div>
                  )}
                  <ActionForm
                    action={deletePhoto.bind(null, item.id, p.id)}
                    submitLabel="Elimina"
                    pendingLabel="…"
                    successMessage={null}
                    variant="danger"
                    confirm="Eliminare questa foto?"
                  />
                </li>
              ))}
            </ul>
          )}
          <div className="mt-5 border-t border-stone-100 pt-4">
            <PhotoUploader itemId={item.id} userId={auth.data.user.id} />
          </div>
        </Section>

        <Section title="Vendita">
          {sale && (
            <div className="mb-5 rounded-md border border-stone-200 bg-stone-50 p-4 text-sm">
              <p className="font-medium text-stone-900">
                {isReturned ? "Vendita precedente (capo reso: non conta nei ricavi)" : "Vendita registrata"}
              </p>
              <dl className="mt-2 grid max-w-sm grid-cols-[1fr_auto] gap-x-6 gap-y-1">
                <dt className="text-stone-600">Canale e data</dt>
                <dd className="text-right">{sale.channel} · {formatDate(sale.sold_at)}</dd>
                <dt className="text-stone-600">Prezzo incassato</dt>
                <dd className="text-right tabular-nums">{formatEuro(sale.price_cents)}</dd>
                <dt className="text-stone-600">Commissioni</dt>
                <dd className="text-right tabular-nums">− {formatEuro(sale.fees_cents)}</dd>
                <dt className="text-stone-600">Spedizione in uscita</dt>
                <dd className="text-right tabular-nums">− {formatEuro(sale.outbound_shipping_cents)}</dd>
                <dt className="text-stone-600">Costi extra</dt>
                <dd className="text-right tabular-nums">− {formatEuro(sale.extra_costs_cents)}</dd>
                <dt className="border-t border-stone-200 pt-1 font-medium">Ricavo netto</dt>
                <dd className="border-t border-stone-200 pt-1 text-right font-medium tabular-nums">
                  {formatEuro(saleNetRevenue({ price: sale.price_cents, fees: sale.fees_cents, outboundShipping: sale.outbound_shipping_cents, extraCosts: sale.extra_costs_cents }))}
                </dd>
                <dt className="text-stone-600">Costo attribuito del lotto</dt>
                <dd className="text-right tabular-nums">− {formatEuro(unitCost)}</dd>
                {isSold && profit !== null && (
                  <>
                    <dt className="border-t border-stone-200 pt-1 font-semibold">Profitto</dt>
                    <dd className={`border-t border-stone-200 pt-1 text-right font-semibold tabular-nums ${profit < 0 ? "text-red-800" : "text-green-800"}`}>{formatEuro(profit)}</dd>
                  </>
                )}
              </dl>
              {sale.notes && <p className="mt-2 whitespace-pre-wrap text-stone-700">{sale.notes}</p>}

              {isSold && (
                <div className="mt-4 flex flex-wrap gap-4 border-t border-stone-200 pt-3">
                  <ActionForm
                    action={markReturned.bind(null, item.id)}
                    submitLabel="Segna come reso"
                    pendingLabel="…"
                    successMessage={null}
                    variant="quiet"
                    confirm="Il cliente ha restituito il capo? Uscirà da ricavi e valore dello stock."
                  />
                  <ActionForm
                    action={undoSale.bind(null, item.id)}
                    submitLabel="Annulla vendita (inserita per errore)"
                    pendingLabel="…"
                    successMessage={null}
                    variant="danger"
                    confirm="Eliminare questa vendita? Il capo tornerà «pronto per la vendita»."
                  />
                </div>
              )}
            </div>
          )}

          <h3 className="text-sm font-semibold text-stone-900">
            {isSold ? "Modifica i dati della vendita" : isReturned ? "Registra una nuova vendita" : "Registra la vendita"}
          </h3>
          {isReturned && (
            <p className="mt-1 text-xs text-stone-500">Una nuova vendita sostituisce quella precedente.</p>
          )}
          <ActionForm
            action={recordSale.bind(null, item.id)}
            submitLabel={isSold ? "Salva vendita" : "Registra vendita"}
            successMessage="Vendita salvata."
            className="mt-2 space-y-3"
          >
            <datalist id="canali">
              {CHANNEL_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
            </datalist>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Canale di vendita" name="channel" required list="canali" defaultValue={sale?.channel ?? ""} />
              <Field label="Data" name="sold_at" type="date" required defaultValue={sale?.sold_at ?? todayIso()} />
              <Field label="Prezzo incassato (€)" name="price_cents" required defaultValue={sale ? centsToInput(sale.price_cents) : centsToInput(item.expected_price_cents)} hint="Quanto paga il cliente per il capo, senza la spedizione che paga lui." />
              <Field label="Commissioni (€)" name="fees_cents" defaultValue={sale ? centsToInput(sale.fees_cents) : ""} />
              <Field label="Spedizione in uscita (€)" name="outbound_shipping_cents" defaultValue={sale ? centsToInput(sale.outbound_shipping_cents) : ""} hint="Solo se la paghi tu al cliente." />
              <Field label="Costi extra (€)" name="extra_costs_cents" defaultValue={sale ? centsToInput(sale.extra_costs_cents) : ""} hint="Imballo, pulizia, riparazione…" />
            </div>
            <Field as="textarea" label="Note" name="notes" rows={2} defaultValue={sale?.notes ?? ""} />
          </ActionForm>
        </Section>

        <Section title="Dati del capo">
          <ItemForm action={updateItem.bind(null, item.id)} item={item} submitLabel="Salva modifiche" />
        </Section>

        <Section title="Elimina capo">
          <p className="text-sm text-stone-600">
            Elimina il capo e le sue foto. Non è possibile se ha una vendita registrata: annullala prima.
          </p>
          <ActionForm
            action={deleteItem.bind(null, item.id)}
            submitLabel="Elimina capo"
            pendingLabel="Eliminazione…"
            successMessage={null}
            variant="danger"
            confirm="Eliminare definitivamente questo capo e le sue foto?"
          />
        </Section>
      </div>
    </>
  );
}
