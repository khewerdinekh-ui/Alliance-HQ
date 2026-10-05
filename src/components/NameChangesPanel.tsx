"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { resolveNameChange } from "@/app/(app)/members/actions";

// Imports never rename anyone on their own — when a row was matched to a
// member under a different spelling it lands here, so a real in-game rename
// can be confirmed and an AI misread can be dismissed.
export default function NameChangesPanel({
  items,
}: {
  items: { id: string; name: string; pending: string }[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const visible = items.filter((i) => !hidden.has(i.id));
  if (visible.length === 0) return null;

  async function resolve(id: string, accept: boolean) {
    setBusy(id);
    setError(null);
    const res = await resolveNameChange(id, accept);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setHidden((prev) => new Set(prev).add(id));
    router.refresh();
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-sky-200 bg-sky-50/60">
      <div className="flex items-start justify-between px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-sky-900">Possible name changes</h3>
          <p className="mt-0.5 text-xs text-sky-700">
            An import matched these members under a different spelling. Names are unchanged — rename only if
            it&apos;s a real in-game change, not an AI misread.
          </p>
        </div>
        <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-sky-100 px-1.5 text-xs font-semibold text-sky-700">
          {visible.length}
        </span>
      </div>
      {error && <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="space-y-2 px-5 pb-5">
        {visible.map((i) => (
          <div
            key={i.id}
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-sky-100 bg-white px-4 py-3"
          >
            <p className="text-sm text-slate-900">
              <span className="font-medium">{i.name}</span>
              <span className="mx-2 text-slate-400">→ read as</span>
              <span className="font-medium text-sky-800">{i.pending}</span>
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => resolve(i.id, true)}
                disabled={busy === i.id}
                className="rounded-full bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
              >
                Rename
              </button>
              <button
                onClick={() => resolve(i.id, false)}
                disabled={busy === i.id}
                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                Keep name
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
