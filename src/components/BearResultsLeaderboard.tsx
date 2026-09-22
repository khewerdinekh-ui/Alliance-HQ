"use client";

import { useState, useTransition } from "react";
import { addBearResult, removeBearResult } from "@/app/(app)/events/actions";

type Result = { memberId: string; name: string; score: number };

const RANK_STYLES = [
  { badge: "bg-amber-400 text-amber-950 shadow-amber-400/40", bar: "bg-amber-400", medal: "🥇" },
  { badge: "bg-slate-300 text-slate-700 shadow-slate-300/40", bar: "bg-slate-300", medal: "🥈" },
  { badge: "bg-orange-300 text-orange-900 shadow-orange-300/40", bar: "bg-orange-300", medal: "🥉" },
];

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
  const topScore = sorted[0]?.score ?? 0;
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
      <div className="flex items-center gap-2">
        <span className="text-lg leading-none">🏆</span>
        <p className="text-sm font-semibold text-slate-900">Saved results</p>
        {sorted.length > 0 && (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
            {sorted.length}
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60 px-3 py-2.5">
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
            className="rounded-full bg-amber-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-500/30 transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            + Add result
          </button>
        </div>
      )}

      <div className="mt-4 space-y-1.5">
        {sorted.map((r, i) => {
          const rank = RANK_STYLES[i];
          const pct = topScore > 0 ? Math.max(6, Math.round((r.score / topScore) * 100)) : 0;
          return (
            <div
              key={r.memberId}
              className={`group relative flex items-center gap-3 overflow-hidden rounded-xl border px-3 py-2.5 transition ${
                i === 0
                  ? "border-amber-200 bg-amber-50/60"
                  : "border-slate-100 bg-white hover:border-slate-200 hover:bg-slate-50/60"
              }`}
            >
              <div
                className={`absolute inset-y-0 left-0 -z-0 opacity-10 ${rank ? rank.bar : "bg-teal-400"}`}
                style={{ width: `${pct}%` }}
              />
              <span
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold shadow-sm ${
                  rank ? rank.badge : "bg-slate-100 text-slate-500"
                }`}
              >
                {rank ? rank.medal : i + 1}
              </span>
              <span className="relative z-10 flex-1 truncate text-sm font-medium text-slate-900">
                {r.name}
              </span>
              <span className="relative z-10 font-mono text-sm font-bold tabular-nums text-amber-700">
                {r.score.toLocaleString()}
              </span>
              {isAdmin && (
                <button
                  onClick={() => handleRemove(r.memberId)}
                  className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-slate-300 opacity-0 transition hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
                  aria-label={`Remove ${r.name}`}
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
        {sorted.length === 0 && (
          <p className="py-8 text-center text-sm text-slate-400">No results saved yet.</p>
        )}
      </div>
    </div>
  );
}
