"use client";

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
    danger: "px-2 py-1 text-red-700 hover:bg-red-50",
    quiet: "px-2 py-1 text-stone-700 hover:bg-stone-100",
  }[variant];
  return (
    <button
      type="submit"
      disabled={pending}
      className={`rounded-md text-sm font-medium disabled:opacity-60 ${styles}`}
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
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <SubmitButton label={submitLabel} pendingLabel={pendingLabel} variant={variant} />
        {state.error && (
          <p role="alert" className="whitespace-pre-line text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.ok && (state.message ?? successMessage) && (
          <p role="status" className="break-all text-sm text-green-700">
            {state.message ?? successMessage}
          </p>
        )}
      </div>
    </form>
  );
}

const controlClass =
  "mt-1 w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 focus:border-stone-900 focus:outline-none";

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
}) {
  const submitted = useContext(ValuesContext);
  const value = submitted?.[name] ?? defaultValue;
  const id = `f-${name}`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-stone-700">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </label>
      {as === "textarea" ? (
        <textarea id={id} name={name} rows={rows} defaultValue={value} placeholder={placeholder} className={controlClass} />
      ) : as === "select" ? (
        <select id={id} name={name} defaultValue={value} className={controlClass}>
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
      {hint && <p className="mt-1 text-xs text-stone-500">{hint}</p>}
    </div>
  );
}
