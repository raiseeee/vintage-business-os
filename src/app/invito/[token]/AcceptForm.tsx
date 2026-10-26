"use client";

import { useActionState } from "react";
import { acceptInvite, type AcceptState } from "./actions";

export function AcceptForm({ token }: { token: string }) {
  const [state, formAction, pending] = useActionState(acceptInvite.bind(null, token), { error: null } as AcceptState);
  return (
    <form action={formAction} className="space-y-3">
      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-md bg-accent px-3 py-2 text-sm font-medium text-white hover:bg-[#243897] disabled:opacity-60"
      >
        {pending ? "Attendi…" : "Accetta l'invito"}
      </button>
    </form>
  );
}
