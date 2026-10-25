import { ActionForm, Field, type FormState } from "@/components/form";
import { centsToInput } from "@/lib/money";
import type { LotRow } from "@/lib/business/types";

export function LotForm({
  action,
  lot,
  defaults,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  lot?: LotRow;
  /** Valori iniziali per un nuovo lotto. */
  defaults?: { code?: string; purchasedAt?: string };
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Fornitore (facoltativo)" name="supplier_name" defaultValue={lot?.supplier_name ?? ""} hint="Da chi hai comprato il lotto: solo un promemoria." />
        <Field label="Codice lotto" name="code" required defaultValue={lot?.code ?? defaults?.code ?? ""} hint="Univoco. Lo usi per i codici dei capi." />
        <Field label="Data di acquisto" name="purchased_at" type="date" required defaultValue={lot?.purchased_at ?? defaults?.purchasedAt ?? ""} />
        <Field label="Quantità di capi" name="quantity" required defaultValue={lot?.quantity?.toString() ?? ""} hint="Numero di capi dichiarato all'acquisto: il costo si divide per questo numero." />
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-1 text-sm font-semibold text-stone-900">Costi del lotto (€)</legend>
        <Field label="Merce" name="purchase_cost_cents" required defaultValue={centsToInput(lot?.purchase_cost_cents)} placeholder="150,00" />
        <Field label="Spedizione in entrata" name="inbound_shipping_cents" defaultValue={lot ? centsToInput(lot.inbound_shipping_cents) : ""} hint="Quella per ricevere il lotto. Quella ai clienti va sulla vendita." />
        <Field label="Altri costi" name="other_costs_cents" defaultValue={lot ? centsToInput(lot.other_costs_cents) : ""} hint="Dogana, imballi, ispezione…" />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Peso totale (kg)" name="weight_kg" defaultValue={lot?.weight_kg?.toString() ?? ""} />
      </div>
      <Field as="textarea" label="Note" name="notes" defaultValue={lot?.notes ?? ""} />
    </ActionForm>
  );
}
