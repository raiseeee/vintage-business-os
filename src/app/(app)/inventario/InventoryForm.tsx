"use client";

import { useState } from "react";
import { ActionForm, Field, useSubmittedValues, type FormState } from "@/components/form";
import { INVENTORY_KIND_LABELS, INVENTORY_KINDS, type InventoryKind, type InventoryRow } from "@/lib/inventory/calc";
import { centsToInput } from "@/lib/money";

/**
 * Campi del form. Stanno DENTRO l'ActionForm perché questo si ricrea dopo ogni invio:
 * così anche la scelta del tipo torna al valore iniziale (o a quello appena inviato in caso di errore).
 */
function InventoryFields({ item, today }: { item?: InventoryRow; today: string }) {
  const submitted = useSubmittedValues();
  const initial = (submitted?.kind ?? item?.kind ?? "materiale") as InventoryKind;
  const [kind, setKind] = useState<InventoryKind>(initial);
  const isMaterial = kind === "materiale";

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          as="select"
          label="Tipo"
          name="kind"
          defaultValue={item?.kind ?? "materiale"}
          options={INVENTORY_KINDS.map((k) => ({ value: k, label: INVENTORY_KIND_LABELS[k] }))}
          hint="Materiale: si consuma e costa qualcosa a ogni capo. Attrezzatura: la compri una volta e non entra nel costo dei capi."
          onChange={(v) => setKind(v as InventoryKind)}
        />
        <Field label="Cosa hai preso" name="name" required defaultValue={item?.name ?? ""} placeholder={isMaterial ? "Sacchetti per spedizioni" : "Stampante etichette"} />
        <Field label="Costo totale (€)" name="total_cost_cents" required defaultValue={centsToInput(item?.total_cost_cents)} placeholder={isMaterial ? "10,00" : "200,00"} />
        <Field
          label="Quantità acquistata"
          name="quantity"
          required
          defaultValue={item?.quantity?.toString() ?? "1"}
          hint={isMaterial ? "Es. 100 sacchetti." : "Di solito 1."}
        />
        {isMaterial && (
          <>
            <Field
              label="Quantità usata per ogni capo"
              name="per_item_qty"
              defaultValue={item ? String(item.per_item_qty).replace(".", ",") : "1"}
              hint="Es. 1 sacchetto, oppure 0,5 se una scatola serve per due capi."
            />
            <Field
              as="select"
              label="Conta nel costo dei capi?"
              name="in_use"
              defaultValue={item ? (item.in_use ? "si" : "no") : "si"}
              options={[
                { value: "si", label: "Sì, è in uso" },
                { value: "no", label: "No" },
              ]}
              hint="Spegni la vecchia confezione quando ne usi una nuova, per non contarle due volte."
            />
          </>
        )}
        <Field label="Data di acquisto" name="purchased_at" type="date" required defaultValue={item?.purchased_at ?? today} />
      </div>
      <Field as="textarea" label="Note" name="notes" defaultValue={item?.notes ?? ""} />
    </div>
  );
}

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
    <ActionForm action={action} submitLabel={submitLabel}>
      <InventoryFields item={item} today={today} />
    </ActionForm>
  );
}
