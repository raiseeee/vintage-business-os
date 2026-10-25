"use client";

import { useRouter, usePathname } from "next/navigation";
import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Pulsante + finestra modale (<dialog> nativo: focus intrappolato, Esc per chiudere).
 * `defaultOpen` apre la finestra al caricamento (usato dai link "?nuovo=1" di altre pagine);
 * alla chiusura i parametri di ricerca vengono ripuliti.
 */
export function ModalButton({
  label,
  title,
  description,
  children,
  defaultOpen = false,
  variant = "primary",
}: {
  label: string;
  title: string;
  description?: string;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: "primary" | "secondary" | "link" | "quiet";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const dialog = ref.current;
    if (defaultOpen && dialog && !dialog.open) dialog.showModal();
  }, [defaultOpen]);

  const trigger = {
    primary: "rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700",
    secondary: "rounded-md border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50",
    link: "font-medium text-stone-900 underline",
    quiet: "rounded-md px-2 py-1 text-sm font-medium text-stone-700 hover:bg-stone-100",
  }[variant];

  return (
    <>
      <button type="button" className={trigger} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog
        ref={ref}
        aria-labelledby={titleId}
        onClose={() => {
          if (defaultOpen) router.replace(pathname);
        }}
        onClick={(e) => {
          if (e.target === ref.current) ref.current?.close();
        }}
        className="m-auto max-h-[90vh] w-[min(52rem,calc(100vw-1.5rem))] rounded-lg border border-stone-200 bg-white p-0 shadow-xl backdrop:bg-stone-900/50"
      >
        <div className="flex items-start justify-between gap-4 border-b border-stone-200 px-5 py-4">
          <div>
            <h2 id={titleId} className="text-lg font-semibold text-stone-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-stone-600">{description}</p>}
          </div>
          <button
            type="button"
            aria-label="Chiudi"
            onClick={() => ref.current?.close()}
            className="rounded-md px-2 py-1 text-stone-500 hover:bg-stone-100 hover:text-stone-900"
          >
            ✕
          </button>
        </div>
        <div className="max-h-[calc(90vh-5.5rem)] overflow-y-auto p-5">{children}</div>
      </dialog>
    </>
  );
}
