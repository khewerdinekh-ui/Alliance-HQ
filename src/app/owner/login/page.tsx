"use client";

import { useActionState } from "react";
import { ownerLogin } from "./actions";

export default function OwnerLoginPage() {
  const [error, action, pending] = useActionState(ownerLogin, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/10">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Site owner</p>
        <h1 className="mt-1 text-xl font-semibold text-slate-900">Owner sign-in.</h1>
        <p className="mt-1 text-sm text-slate-500">
          Separate from any alliance login — only you have this password.
        </p>

        <form action={action} className="mt-5 space-y-3">
          <input
            type="password"
            name="password"
            placeholder="Owner password"
            required
            autoFocus
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
