import { ActionForm, Field } from "@/components/form";
import type { LotRow } from "@/lib/business/types";
import { importItems } from "./actions";

/** Importazione di molti capi da CSV nel lotto scelto. */
export function ImportForm({ lots, defaultLotId }: { lots: LotRow[]; defaultLotId?: string }) {
  return (
    <div className="space-y-4">
      <div className="rounded-md bg-stone-50 p-4 text-sm text-stone-700">
        <p className="font-semibold text-stone-900">Come si prepara il file</p>
        <ul className="mt-2 list-disc space-y-2 pl-6">
          <li>Una riga per capo; la prima riga contiene i nomi delle colonne.</li>
          <li>
            Colonne riconosciute: <strong>marca, categoria, taglia, condizione, prezzo previsto, note</strong> (tutte facoltative).
            Condizione: ottima, buona, discreta, da riparare. Prezzo con la virgola (es. 25,50).
          </li>
          <li>I codici non vanno nel file: li assegna l&apos;app, in ordine (es. L-001-001, L-001-002…), partendo dal numero successivo a quelli già nel lotto.</li>
          <li>Tutti i capi entrano nel lotto scelto con stato «da controllare». Le foto le aggiungi dopo dalla scheda di ogni capo.</li>
          <li>Se una riga non è valida non viene importato nulla e ti dico quale correggere. Massimo 500 capi.</li>
        </ul>
        <p className="mt-4">
          <a href="/capi/modello" download className="font-semibold text-stone-900 underline">Scarica il modello CSV</a>{" "}
          (si apre con Excel; salva come «CSV» con separatore punto e virgola).
        </p>
      </div>

      <ActionForm action={importItems} submitLabel="Importa capi" pendingLabel="Importazione…" className="space-y-4">
        <Field
          as="select"
          label="Lotto di provenienza"
          name="lot_id"
          defaultValue={defaultLotId ?? lots[0]?.id ?? ""}
          options={lots.map((l) => ({ value: l.id, label: l.code }))}
        />
        <div>
          <label htmlFor="import-file" className="block text-sm font-semibold text-stone-700">File CSV</label>
          <input
            id="import-file"
            name="file"
            type="file"
            accept=".csv,text/csv,text/plain"
            required
            className="mt-2 block w-full text-sm text-stone-700 file:mr-4 file:rounded-md file:border-0 file:bg-stone-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-stone-700"
          />
        </div>
      </ActionForm>
    </div>
  );
}
