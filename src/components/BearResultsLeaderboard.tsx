"use client";

import { useState, useTransition } from "react";
import { addBearResult, removeBearResult } from "@/app/(app)/events/actions";

type Result = { memberId: string; name: string; score: number };

export default function BearResultsLeaderboard({
  orgId,
  eventId,
  isAdmin,
  members,
  results,
}: {
  orgId: string;
  eventId: string;
  isAdmin: boolean;
  members: { id: string; name: string }[];
  results: Result[];
}) {
  const [, startTransition] = useTransition();
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [score, setScore] = useState("");

  const sorted = [...results].sort((a, b) => b.score - a.score);
  const resultMemberIds = new Set(results.map((r) => r.memberId));
  const available = members.filter((m) => !resultMemberIds.has(m.id));

  function handleAdd() {
    if (!selectedMemberId || !score.trim()) return;
    const formData = new FormData();
    formData.set("orgId", orgId);
    formData.set("eventId", eventId);
    formData.set("memberId", selectedMemberId);
    formData.set("score", score.replace(/,/g, ""));
    startTransition(() => {
      addBearResult(formData);
    });
    setSelectedMemberId("");
    setScore("");
  }

  function handleRemove(memberId: string) {
    const formData = new FormData();
    formData.set("eventId", eventId);
    formData.set("memberId", memberId);
    startTransition(() => {
      removeBearResult(formData);
    });
  }

  return (
    <div className="px-5 py-4">
      <p className="text-sm font-semibold text-slate-900">Saved results</p>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={selectedMemberId}
            onChange={(e) => setSelectedMemberId(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="">Add a player</option>
            {available.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <input
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="Score"
            inputMode="numeric"
            className="w-32 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
          <button
            onClick={handleAdd}
            disabled={!selectedMemberId || !score.trim()}
            className="rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Add result
          </button>
        </div>
      )}

      <div className="mt-4 divide-y divide-slate-100">
        {sorted.map((r, i) => (
          <div key={r.memberId} className="flex items-center justify-between gap-3 py-2.5">
            <div className="flex items-center gap-3">
              <span className="w-8 shrink-0 text-sm font-medium text-slate-400">#{i + 1}</span>
              <span className="text-sm font-medium text-slate-900">{r.name}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm font-semibold text-amber-700">
                {r.score.toLocaleString()}
              </span>
              {isAdmin && (
                <button
                  onClick={() => handleRemove(r.memberId)}
                  className="text-xs font-semibold text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
        {sorted.length === 0 && (
          <p className="py-6 text-center text-sm text-slate-400">No results saved yet.</p>
        )}
      </div>
    </div>
  );
}
