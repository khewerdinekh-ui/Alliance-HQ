"use client";

import { useActionState } from "react";
import { joinOrg } from "../actions";

export default function JoinOrgPage() {
  const [error, formAction, pending] = useActionState(joinOrg, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Join an alliance</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask your R5 for the alliance name and password.
        </p>

        <form action={formAction} className="mt-6 space-y-4">
          <Field label="Alliance name" name="orgName" required />
          <Field label="Alliance password" name="password" type="password" required />
          <Field label="Your Chief ID" name="chiefId" required />
          <Field label="Your in-game name" name="displayName" required />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-teal-600 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {pending ? "Joining…" : "Join alliance"}
          </button>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required = false,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
  );
}
