"use client";

import { Field } from "@/components/form";
import {
  ITEM_CONDITIONS,
  ITEM_CONDITION_LABELS,
  ITEM_STATUS_LABELS,
  MANUAL_ITEM_STATUSES,
} from "@/lib/business/constants";
import type { ItemRow, LotRow } from "@/lib/business/types";
import { centsToInput } from "@/lib/money";

const conditionOptions = [
  { value: "", label: "— non indicata —" },
  ...ITEM_CONDITIONS.map((c) => ({ value: c, label: ITEM_CONDITION_LABELS[c] })),
];

const statusOptions = MANUAL_ITEM_STATUSES.map((s) => ({ value: s, label: ITEM_STATUS_LABELS[s] }));

/** Campi del capo, condivisi tra creazione e modifica. Vanno dentro un ActionForm. */
export function ItemFields({
  item,
  lots,
  defaults,
}: {
  item?: ItemRow;
  /** Presente solo per un nuovo capo: il lotto di provenienza non si cambia dopo. */
  lots?: LotRow[];
  defaults?: { lotId?: string; code?: string };
}) {
  const sold = item?.status === "venduto";

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {lots && (
          <Field
            as="select"
            label="Lotto di provenienza"
            name="lot_id"
            defaultValue={defaults?.lotId ?? lots[0]?.id ?? ""}
            options={lots.map((l) => ({ value: l.id, label: l.code }))}
          />
        )}
        <Field label="Codice capo" name="code" required defaultValue={item?.code ?? defaults?.code ?? ""} hint="Univoco." />
        <Field label="Marca" name="brand" defaultValue={item?.brand ?? ""} />
        <Field label="Categoria" name="category" defaultValue={item?.category ?? ""} placeholder="Felpa, giacca, t-shirt…" />
        <Field label="Taglia" name="size" defaultValue={item?.size ?? ""} />
        <Field as="select" label="Condizione" name="condition" options={conditionOptions} defaultValue={item?.condition ?? ""} />
        {sold ? (
          // Il capo è venduto: lo stato non si modifica da qui (il server lo ignora).
          <>
            <input type="hidden" name="status" value="pronto" />
            <div>
              <p className="block text-sm font-medium text-stone-700">Stato</p>
              <p className="mt-2 text-sm text-stone-600">
                Venduto. Per cambiarlo, annulla la vendita o segnalo come reso (sezione Vendita).
              </p>
            </div>
          </>
        ) : (
          <Field as="select" label="Stato" name="status" options={statusOptions} defaultValue={item?.status ?? "da_controllare"} />
        )}
        <Field label="Prezzo di vendita previsto (€)" name="expected_price_cents" defaultValue={centsToInput(item?.expected_price_cents)} />
      </div>
      <Field as="textarea" label="Note" name="notes" defaultValue={item?.notes ?? ""} />
    </>
  );
}
