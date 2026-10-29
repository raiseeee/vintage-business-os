import { ActionForm, Field } from "@/components/form";
import { ModalButton } from "@/components/Modal";
import { CHANNEL_SUGGESTIONS } from "@/lib/business/constants";
import type { ItemRow } from "@/lib/business/types";
import { todayIso } from "@/lib/dates";
import { centsToInput } from "@/lib/money";
import { publishItem, recordSale } from "./actions";

/**
 * Il passo successivo di un capo, a un clic:
 *  - «Pronto per la vendita»: Pubblica: chiede dove l'hai messo in vendita;
 *  - «Pubblicato»: Segna venduto: chiede il prezzo (e il resto) e registra la vendita.
 * `key` sullo stato: quando lo stato cambia la finestra si richiude da sola.
 */
export function QuickAction({ item, variant = "quiet" }: { item: ItemRow; variant?: "quiet" | "secondary" }) {
  if (item.status === "pronto") {
    const listId = `canali-pub-${item.id}`;
    return (
      <ModalButton
        key={item.status}
        label="Pubblica"
        variant={variant}
        title={`Pubblica ${item.code}`}
        description="Dove l'hai messo in vendita? Il capo passa a «Pubblicato»."
      >
        <ActionForm
          action={publishItem.bind(null, item.id)}
          submitLabel="Segna come pubblicato"
          pendingLabel="Salvataggio…"
          successMessage={null}
          className="space-y-4"
        >
          <datalist id={listId}>
            {CHANNEL_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
          <Field label="Dove l'hai messo in vendita" name="channel" required list={listId} placeholder="Vinted" defaultValue={item.listing_channel ?? ""} />
        </ActionForm>
      </ModalButton>
    );
  }

  if (item.status === "pubblicato") {
    const listId = `canali-sale-${item.id}`;
    return (
      <ModalButton
        key={item.status}
        label="Segna venduto"
        variant={variant}
        title={`Venduto: ${item.code}`}
        description="Inserisci il prezzo: il capo passa a «Venduto» e la vendita viene registrata."
      >
        <ActionForm
          action={recordSale.bind(null, item.id)}
          submitLabel="Registra vendita"
          pendingLabel="Salvataggio…"
          successMessage={null}
          className="space-y-4"
        >
          <datalist id={listId}>
            {CHANNEL_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field
              label="Prezzo di vendita (€)"
              name="price_cents"
              required
              defaultValue={centsToInput(item.expected_price_cents)}
              hint="Quanto ha pagato il cliente per il capo, senza la spedizione che paga lui."
            />
            <Field label="Canale" name="channel" required list={listId} defaultValue={item.listing_channel ?? ""} />
            <Field label="Data" name="sold_at" type="date" required defaultValue={todayIso()} />
          </div>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-stone-700 hover:text-stone-900">Costi della vendita (facoltativi, si possono aggiungere dopo)</summary>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <Field label="Commissioni (€)" name="fees_cents" />
              <Field label="Spedizione in uscita (€)" name="outbound_shipping_cents" hint="Solo se la paghi tu." />
              <Field label="Costi extra (€)" name="extra_costs_cents" />
            </div>
          </details>
        </ActionForm>
      </ModalButton>
    );
  }

  return null;
}
