"use client";

import { useActionState, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { createOrg, joinOrg } from "./actions";

export default function OnboardingClient() {
  const [tab, setTab] = useState<"join" | "create">("join");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }
      setReady(true);
    })();
  }, []);

  const [joinError, joinAction, joinPending] = useActionState(joinOrg, undefined);
  const [createError, createAction, createPending] = useActionState(createOrg, undefined);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Alliance HQ</h1>
        <p className="mt-1 text-sm text-slate-500">Join your alliance or start a new one.</p>

        <div className="mt-6 flex rounded-full bg-slate-100 p-1 text-sm font-medium">
          <button
            type="button"
            onClick={() => setTab("join")}
            className={`flex-1 rounded-full py-1.5 transition ${
              tab === "join" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Join alliance
          </button>
          <button
            type="button"
            onClick={() => setTab("create")}
            className={`flex-1 rounded-full py-1.5 transition ${
              tab === "create" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
          >
            Create alliance
          </button>
        </div>

        {tab === "join" ? (
          <form action={joinAction} className="mt-6 space-y-4">
            <Field label="Player name" name="displayName" placeholder="Your in-game name" required />
            <Field label="Chief ID" name="chiefId" placeholder="Your numeric Chief ID" required />
            <Field label="Alliance name" name="orgName" placeholder="e.g. ICX" required />
            <Field label="State" name="state" placeholder="e.g. 686" required />
            <Field
              label="Alliance password"
              name="password"
              type="password"
              placeholder="Enter the password from your R5"
              required
            />

            {joinError && <p className="text-sm text-red-600">{joinError}</p>}

            <button
              type="submit"
              disabled={!ready || joinPending}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {joinPending ? "Entering…" : "Enter Alliance HQ"}
            </button>
          </form>
        ) : (
          <form action={createAction} className="mt-6 space-y-4">
            <Field label="Player name" name="displayName" placeholder="Your in-game name" required />
            <Field label="Chief ID" name="chiefId" placeholder="Your numeric Chief ID" required />

            <div className="rounded-xl border border-teal-100 bg-teal-50 p-4">
              <Field label="Alliance name" name="orgName" placeholder="e.g. ICX" required />
              <div className="mt-3">
                <Field label="State" name="state" placeholder="e.g. 686" required />
              </div>
              <p className="mt-3 text-xs text-teal-800">
                You will become this alliance&apos;s R5 and can pass control to another member
                later.
              </p>
            </div>

            <Field
              label="Alliance password"
              name="password"
              type="password"
              placeholder="Choose at least 8 characters"
              required
              minLength={8}
            />

            {createError && <p className="text-sm text-red-600">{createError}</p>}

            <button
              type="submit"
              disabled={!ready || createPending}
              className="w-full rounded-lg bg-teal-600 py-2.5 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {createPending ? "Creating…" : "Enter Alliance HQ"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = false,
  minLength,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
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
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    </div>
  );
}
