import { ActionForm, type FormState } from "@/components/form";
import type { ItemRow } from "@/lib/business/types";
import { ItemFields } from "./ItemFields";

/** Modifica di un capo esistente. (La creazione, con le foto, è in NewItemForm.) */
export function ItemForm({
  action,
  item,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  item: ItemRow;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} className="space-y-4">
      <ItemFields item={item} />
    </ActionForm>
  );
}
