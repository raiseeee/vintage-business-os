"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "./actions";

const initialState: LoginState = { error: null };

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <label htmlFor="email" className="block text-sm font-semibold text-stone-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          className="mt-2 w-full rounded-md border border-stone-300 px-4 py-2 text-sm focus:border-stone-900 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-semibold text-stone-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="mt-2 w-full rounded-md border border-stone-300 px-4 py-2 text-sm focus:border-stone-900 focus:outline-none"
        />
      </div>

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
        {pending ? "Accesso in corso…" : "Accedi"}
      </button>
    </form>
  );
}
