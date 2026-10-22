import { ActionForm, Field, type FormState } from "@/components/form";
import { centsToInput } from "@/lib/money";
import { SUPPLIER_TYPES, SUPPLIER_TYPE_LABELS } from "@/lib/suppliers/constants";
import type { Supplier } from "@/lib/suppliers/types";

const typeOptions = SUPPLIER_TYPES.map((t) => ({ value: t, label: SUPPLIER_TYPE_LABELS[t] }));

export function SupplierForm({
  action,
  supplier,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  supplier?: Supplier;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Nome azienda" name="name" required defaultValue={supplier?.name} />
        <Field label="Sito web" name="website" defaultValue={supplier?.website ?? ""} placeholder="esempio.com" />
        <Field label="Paese" name="country" defaultValue={supplier?.country ?? ""} placeholder="IT" hint="Codice a 2 lettere: IT, DE, PL…" />
        <Field
          as="select"
          label="Tipo di fornitore"
          name="supplier_type"
          options={typeOptions}
          defaultValue={supplier?.supplier_type ?? "origine_non_verificata"}
          hint="«Diretto» e «grossista documentato» richiedono una provenienza documentata con fonte (aggiungila nella scheda)."
        />
        <Field label="Lingue" name="languages" defaultValue={supplier?.languages.join(", ") ?? ""} hint="Separate da virgola: it, en, de" />
        <Field label="Tipologie di stock" name="stock_types" defaultValue={supplier?.stock_types.join(", ") ?? ""} hint="Es. sportswear, streetwear, giacche" />
        <Field label="Marchi" name="brands" defaultValue={supplier?.brands.join(", ") ?? ""} hint="Separati da virgola" />
      </div>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-stone-900">Ordine minimo e prezzi</legend>
        <Field label="Quantità minima (capi)" name="min_order_qty" defaultValue={supplier?.min_order_qty?.toString() ?? ""} />
        <Field label="Peso minimo (kg)" name="min_order_weight_kg" defaultValue={supplier?.min_order_weight_kg?.toString() ?? ""} />
        <Field label="Valore minimo ordine (€)" name="min_order_value_cents" defaultValue={centsToInput(supplier?.min_order_value_cents)} />
        <Field label="Prezzo al kg (€)" name="price_per_kg_cents" defaultValue={centsToInput(supplier?.price_per_kg_cents)} />
      </fieldset>
      <Field as="textarea" label="Note sui prezzi" name="price_notes" defaultValue={supplier?.price_notes ?? ""} />

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-stone-900">Contatti</legend>
        <Field label="Referente" name="contact_name" defaultValue={supplier?.contact_name ?? ""} />
        <Field label="Email" name="contact_email" type="email" defaultValue={supplier?.contact_email ?? ""} />
        <Field label="Telefono" name="contact_phone" defaultValue={supplier?.contact_phone ?? ""} />
      </fieldset>

      <Field as="textarea" label="Note" name="notes" rows={4} defaultValue={supplier?.notes ?? ""} />
    </ActionForm>
  );
}
