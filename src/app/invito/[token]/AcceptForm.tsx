"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptState } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvite.bind(null, token), { error: null } as AcceptState);
  return (
    <form action={formAction} className="space-y-4">
      {state.error && (
        <p role="alert" className="text-sm text-stone-900">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700 disabled:opacity-60"
      >
        {pending ? "Attendi…" : "Accetta l'invito"}
      </button>
    </form>
  );
}
