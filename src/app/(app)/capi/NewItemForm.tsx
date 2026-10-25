"use client";

import { useRouter } from "next/navigation";
import { ActionForm, type FormState } from "@/components/form";
import { PHOTO_MAX_BYTES } from "@/lib/business/constants";
import type { LotRow } from "@/lib/business/types";
import { createItem } from "./actions";
import { ItemFields } from "./ItemFields";
import { uploadPhotos } from "./uploadPhotos";

/**
 * Nuovo capo con foto. Prima si crea il capo (server), poi le foto vanno dal browser
 * direttamente nello storage (le richieste al server hanno un limite di dimensione).
 */
export function NewItemForm({
  lots,
  defaults,
  businessId,
}: {
  lots: LotRow[];
  defaults: { lotId?: string; code?: string };
  businessId: string;
}) {
  const router = useRouter();

  async function action(prev: FormState, formData: FormData): Promise<FormState> {
    const files = formData
      .getAll("photos")
      .filter((f): f is File => f instanceof File && f.size > 0);
    formData.delete("photos");
    // Dice al server che le foto arrivano subito dopo: lo stato scelto non va riportato a «da fotografare».
    if (files.length > 0) formData.set("has_photos", "1");

    const created = await createItem(prev, formData);
    if (!created.ok || !created.itemId) return created;

    if (files.length > 0) {
      const { uploaded, problems } = await uploadPhotos(created.itemId, businessId, files);
      if (problems.length > 0) {
        // Il capo esiste già: riprovare a crearlo darebbe «codice già esistente».
        return {
          error: `Capo creato, ma ${problems.length === 1 ? "una foto non è stata caricata" : `${problems.length} foto non sono state caricate`} (${uploaded} caricate):\n${problems.join("\n")}\nChiudi questa finestra e aggiungile dalla scheda del capo.`,
          ok: false,
        };
      }
    }

    router.push(`/capi/${created.itemId}`);
    return { error: null, ok: true, message: "Capo creato." };
  }

  return (
    <ActionForm action={action} submitLabel="Crea capo" pendingLabel="Salvataggio…" className="space-y-4">
      <ItemFields lots={lots} defaults={defaults} />
      <div>
        <label htmlFor="new-item-photos" className="block text-sm font-medium text-stone-700">Foto (facoltative)</label>
        <input
          id="new-item-photos"
          name="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="mt-1 block w-full text-sm text-stone-700 file:mr-3 file:rounded-md file:border-0 file:bg-stone-900 file:px-3 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-stone-700"
        />
        <p className="mt-1 text-xs text-stone-500">JPG, PNG o WebP, fino a {PHOTO_MAX_BYTES / 1024 / 1024} MB ciascuna.</p>
      </div>
    </ActionForm>
  );
}
