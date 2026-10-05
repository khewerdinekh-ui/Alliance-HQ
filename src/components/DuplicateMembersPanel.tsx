"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { mergeMembers } from "@/app/(app)/import/actions";

type Dup = {
  id: string;
  name: string;
  chiefId: string | null;
  power: number | null;
  level: number | null;
  rank: string;
  createdAt: string;
};

const fmt = (n: number | null) => (n == null ? "—" : n.toLocaleString());

// Two member records with the same name are almost always one person who got
// created twice (e.g. an import that didn't recognise them). Merging keeps the
// older record and its attendance history, folds the other's attendance and
// punishments in, takes the newer record's details, and deletes the extra.
export default function DuplicateMembersPanel({ groups }: { groups: Dup[][] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const visible = groups
    .map((g) => g.filter((m) => !done.has(m.id)))
    .filter((g) => g.length > 1);
  if (visible.length === 0) return null;

  async function merge(keep: Dup, remove: Dup) {
    if (!window.confirm(`Merge the two "${keep.name}" records into one? This can't be undone.`)) return;
    setBusy(remove.id);
    setError(null);
    const res = await mergeMembers(keep.id, remove.id);
    setBusy(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setDone((prev) => new Set(prev).add(remove.id));
    router.refresh();
  }

  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/60">
      <div className="px-5 py-4">
        <h3 className="text-sm font-semibold text-amber-900">Duplicate members ({visible.length})</h3>
        <p className="mt-0.5 text-xs text-amber-700">
          These names appear more than once. If they&apos;re the same person, merge them so attendance and
          percentages are in one place.
        </p>
      </div>
      {error && <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
      <div className="space-y-2 px-5 pb-5">
        {visible.map((g) => {
          const keep = g[0];
          return (
            <div key={keep.id} className="rounded-xl border border-amber-100 bg-white px-4 py-3">
              <p className="text-sm font-medium text-slate-900">{keep.name}</p>
              {g.map((m, idx) => (
                <div key={m.id} className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
                  <span>
                    {idx === 0 ? "Keep (oldest)" : "Extra"} · power {fmt(m.power)} · level {fmt(m.level)} ·{" "}
                    {m.rank} · ID {m.chiefId ?? "—"} · added {m.createdAt.slice(0, 10)}
                  </span>
                  {idx > 0 && (
                    <button
                      onClick={() => merge(keep, m)}
                      disabled={busy === m.id}
                      className="rounded-full bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      {busy === m.id ? "Merging…" : "Merge into oldest"}
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
