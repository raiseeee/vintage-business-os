import { ActionForm, Field, type FormState } from "@/components/form";
import type { SupplierRow } from "@/lib/suppliers/queries";

export function SupplierForm({
  action,
  supplier,
  submitLabel,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  supplier?: SupplierRow;
  submitLabel: string;
}) {
  return (
    <ActionForm action={action} submitLabel={submitLabel} className="space-y-4">
      <Field label="Nome" name="name" required defaultValue={supplier?.name ?? ""} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Email" name="email" type="email" defaultValue={supplier?.email ?? ""} />
        <Field label="Telefono" name="phone" defaultValue={supplier?.phone ?? ""} />
      </div>
      <Field label="Indirizzo" name="address" defaultValue={supplier?.address ?? ""} />
      <Field as="textarea" label="Note" name="notes" rows={2} defaultValue={supplier?.notes ?? ""} />
    </ActionForm>
  );
}
