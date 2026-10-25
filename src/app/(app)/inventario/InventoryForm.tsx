import { ActionForm, Field, type FormState } from "@/components/form";
import { INVENTORY_KIND_LABELS, INVENTORY_KINDS, type InventoryRow } from "@/lib/inventory/calc";
import { centsToInput } from "@/lib/money";

export function InventoryForm({
  action,
  item,
  today,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  item?: InventoryRow;
  today: string;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          as="select"
          label="Tipo"
          name="kind"
          defaultValue={item?.kind ?? "materiale"}
          options={INVENTORY_KINDS.map((k) => ({ value: k, label: INVENTORY_KIND_LABELS[k] }))}
          hint="Materiale: si consuma e costa qualcosa a ogni capo. Attrezzatura: la compri una volta."
        />
        <Field label="Cosa hai preso" name="name" required defaultValue={item?.name ?? ""} placeholder="Sacchetti per spedizioni" />
        <Field label="Costo totale (€)" name="total_cost_cents" required defaultValue={centsToInput(item?.total_cost_cents)} placeholder="10,00" />
        <Field label="Quantità acquistata" name="quantity" required defaultValue={item?.quantity?.toString() ?? "1"} hint="Es. 100 sacchetti. Per un'attrezzatura: 1." />
        <Field
          label="Quantità usata per ogni capo"
          name="per_item_qty"
          defaultValue={item ? String(item.per_item_qty).replace(".", ",") : "1"}
          hint="Solo materiali: es. 1 sacchetto, oppure 0,5 se una scatola serve per due capi."
        />
        <Field
          as="select"
          label="Conta nel costo dei capi?"
          name="in_use"
          defaultValue={item?.in_use ? "si" : "no"}
          options={[
            { value: "si", label: "Sì, è in uso" },
            { value: "no", label: "No" },
          ]}
          hint="Solo materiali. Spegni la vecchia confezione quando ne usi una nuova, per non contarle due volte."
        />
        <Field label="Data di acquisto" name="purchased_at" type="date" required defaultValue={item?.purchased_at ?? today} />
      </div>
      <Field as="textarea" label="Note" name="notes" defaultValue={item?.notes ?? ""} />
    </ActionForm>
  );
}
