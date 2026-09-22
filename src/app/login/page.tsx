"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signIn } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(signIn, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Alliance HQ</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to your command centre.</p>

        <form action={formAction} className="mt-6 space-y-4">
          <div>
            <label htmlFor="chiefId" className="block text-sm font-medium text-slate-700">
              Chief ID
            </label>
            <input
              id="chiefId"
              name="chiefId"
              type="text"
              inputMode="numeric"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="mt-4 text-xs text-slate-400">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="text-teal-600 hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}
