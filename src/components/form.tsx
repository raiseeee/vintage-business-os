"use client";

import { Check, CircleAlert } from "lucide-react";
import { createContext, useActionState, useContext, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export type FormState = {
  error: string | null;
  ok: boolean;
  values?: Record<string, string>;
  /** Messaggio di successo calcolato dall'azione (al posto di quello fisso del form). */
  message?: string;
  /** Id del record creato, quando serve al chiamante. */
  itemId?: string;
};

type ClientState = FormState & { n: number };

const ValuesContext = createContext<Record<string, string> | undefined>(undefined);

/** Valori appena inviati (in caso di errore), per i campi che cambiano in base a un'altra scelta. */
export function useSubmittedValues() {
  return useContext(ValuesContext);
}

function SubmitButton({
  label,
  pendingLabel,
  variant,
}: {
  label: string;
  pendingLabel: string;
  variant: "primary" | "danger" | "quiet";
}) {
  const { pending } = useFormStatus();
  const styles = {
    primary: "bg-stone-900 px-4 py-2 text-white hover:bg-stone-700",
    danger: "px-2 py-2 text-stone-900 hover:bg-stone-100",
    quiet: "px-2 py-2 text-stone-700 hover:bg-stone-100",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md text-sm font-semibold disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}

/**
 * Form collegato a una server action. Mostra errore o conferma e, dopo ogni invio,
 * ricrea i campi: in caso di errore con i valori appena scritti, in caso di successo
 * con i valori iniziali (quindi puliti per i form di inserimento).
 */
export function ActionForm({
  action,
  children,
  submitLabel,
  pendingLabel = "Salvataggio…",
  successMessage = "Salvato.",
  variant = "primary",
  confirm,
  className,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  children?: ReactNode;
  submitLabel: string;
  pendingLabel?: string;
  successMessage?: string | null;
  variant?: "primary" | "danger" | "quiet";
  /** Se presente, chiede conferma prima di inviare. */
  confirm?: string;
  className?: string;
}) {
  const [state, formAction] = useActionState<ClientState, FormData>(
    async (prev, formData) => ({ ...(await action(prev, formData)), n: prev.n + 1 }),
    { error: null, ok: false, n: 0 },
  );

  return (
    <form
      key={state.n}
      action={formAction}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      <ValuesContext.Provider value={state.values}>{children}</ValuesContext.Provider>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} variant={variant} />
        {state.error && (
          <p role="alert" className="flex items-start gap-2 whitespace-pre-line text-sm font-semibold text-stone-900">
            <CircleAlert aria-hidden className="mt-2 size-4 shrink-0" strokeWidth={1.5} />
            {state.error}
          </p>
        )}
        {state.ok && (state.message ?? successMessage) && (
          <p role="status" className="flex items-start gap-2 break-all text-sm text-stone-900">
            <Check aria-hidden className="mt-2 size-4 shrink-0" strokeWidth={1.5} />
            {state.message ?? successMessage}
          </p>
        )}
      </div>
    </form>
  );
}

const controlClass =
  "mt-2 w-full rounded-md border border-stone-300 bg-white px-4 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none";

type Option = { value: string; label: string };

export function Field({
  label,
  name,
  as = "input",
  type = "text",
  defaultValue = "",
  options,
  hint,
  required,
  placeholder,
  list,
  rows = 3,
  onChange,
}: {
  label: string;
  name: string;
  as?: "input" | "textarea" | "select";
  type?: string;
  defaultValue?: string;
  options?: Option[];
  hint?: string;
  required?: boolean;
  placeholder?: string;
  /** Id di un <datalist> con suggerimenti per il campo di testo. */
  list?: string;
  rows?: number;
  /** Chiamata col nuovo valore quando l'utente cambia il campo. */
  onChange?: (value: string) => void;
}) {
  const submitted = useContext(ValuesContext);
  const value = submitted?.[name] ?? defaultValue;
  const id = `f-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-semibold text-stone-700">
        {label}
        {required && <span className="text-stone-900"> *</span>}
      </label>
      {as === "textarea" ? (
        <textarea id={id} name={name} rows={rows} defaultValue={value} placeholder={placeholder} className={controlClass} />
      ) : as === "select" ? (
        <select id={id} name={name} defaultValue={value} className={controlClass} onChange={onChange ? (e) => onChange(e.target.value) : undefined}>
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          id={id}
          name={name}
          type={type}
          defaultValue={value}
          required={required}
          placeholder={placeholder}
          list={list}
          className={controlClass}
        />
      )}
      {hint && <p className="mt-2 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
