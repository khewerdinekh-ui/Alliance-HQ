"use client";

import { useMemo, useState } from "react";
import AttendanceDetailModal, { type AttendanceEntry } from "@/components/AttendanceDetailModal";

type MemberStats = {
  id: string;
  name: string;
  allianceRank: string;
  allianceName: string;
  foundryPct: number;
  canyonPct: number;
  bearPct: number;
  overallPct: number;
  noShowPct: number;
  chiefId: string | null;
  events: AttendanceEntry[];
};

type SortKey = "name" | "rank" | "foundryPct" | "canyonPct" | "bearPct" | "overallPct" | "noShowPct";

export default function PercentagesTable({
  members,
  allianceNames,
}: {
  members: MemberStats[];
  allianceNames: string[];
}) {
  const [search, setSearch] = useState("");
  const [rankFilter, setRankFilter] = useState("all");
  const [allianceFilter, setAllianceFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [detail, setDetail] = useState<{
    title: string;
    subtitle: string;
    entries: AttendanceEntry[];
  } | null>(null);

  const filtered = useMemo(() => {
    let rows = members;
    if (rankFilter !== "all") rows = rows.filter((m) => m.allianceRank === rankFilter);
    if (allianceFilter !== "all") rows = rows.filter((m) => m.allianceName === allianceFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (m) => m.name.toLowerCase().includes(q) || (m.chiefId ?? "").includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name);
      if (sortKey === "rank") return sortDir * a.allianceRank.localeCompare(b.allianceRank);
      return sortDir * (a[sortKey] - b[sortKey]);
    });
  }, [members, rankFilter, allianceFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function openDetail(
    member: MemberStats,
    label: string,
    filter: (e: AttendanceEntry) => boolean,
    subtitle: string
  ) {
    setDetail({
      title: `${label} · ${member.name}`,
      subtitle,
      entries: member.events.filter(filter),
    });
  }

  const ranks = ["R1", "R2", "R3", "R4", "R5"];

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          >
            <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
            <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or Chief ID"
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
        <select
          value={allianceFilter}
          onChange={(e) => setAllianceFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
        >
          <option value="all">All alliances</option>
          {allianceNames.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={rankFilter}
          onChange={(e) => setRankFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
        >
          <option value="all">All ranks</option>
          {ranks.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </div>

      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <Th label="Member" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Rank" k="rank" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Foundry %" k="foundryPct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Canyon %" k="canyonPct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Bear %" k="bearPct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th label="Overall %" k="overallPct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
              <Th label="No-show %" k="noShowPct" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3 font-medium text-slate-900">{m.name}</td>
                <td className="px-4 py-3 text-slate-600">{m.allianceRank}</td>
                <PctCell
                  value={m.foundryPct}
                  onClick={() =>
                    openDetail(
                      m,
                      "Foundry attendance",
                      (e) => e.eventType === "foundry",
                      "Attendance details used for the rolling three-month percentage."
                    )
                  }
                />
                <PctCell
                  value={m.canyonPct}
                  onClick={() =>
                    openDetail(
                      m,
                      "Canyon attendance",
                      (e) => e.eventType === "canyon",
                      "Attendance details used for the rolling three-month percentage."
                    )
                  }
                />
                <PctCell
                  value={m.bearPct}
                  onClick={() =>
                    openDetail(
                      m,
                      "Bear attendance",
                      (e) => e.eventType === "bear",
                      "Attendance details used for the rolling three-month percentage."
                    )
                  }
                />
                <PctCell
                  value={m.overallPct}
                  bold
                  onClick={() =>
                    openDetail(
                      m,
                      "Overall attendance",
                      () => true,
                      "Attendance details used for the rolling three-month percentage."
                    )
                  }
                />
                <PctCell
                  value={m.noShowPct}
                  tone="red"
                  onClick={() =>
                    openDetail(
                      m,
                      "Unexcused no-shows",
                      (e) => e.status === "no_show",
                      "Events where they signed up, did not attend, and no accepted reason was recorded."
                    )
                  }
                />
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No members match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {detail && (
        <AttendanceDetailModal
          title={detail.title}
          subtitle={detail.subtitle}
          entries={detail.entries}
          onClose={() => setDetail(null)}
        />
      )}
    </div>
  );
}

function PctCell({
  value,
  onClick,
  bold,
  tone,
}: {
  value: number;
  onClick: () => void;
  bold?: boolean;
  tone?: "red";
}) {
  return (
    <td className="px-4 py-3">
      <button
        onClick={onClick}
        className={`rounded px-1.5 py-0.5 underline decoration-dotted underline-offset-2 hover:bg-slate-100 ${
          tone === "red" ? "text-red-600" : bold ? "font-semibold text-violet-700" : "text-slate-600"
        }`}
      >
        {value.toFixed(1)}%
      </button>
    </td>
  );
}

function Th({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
}: {
  label: string;
  k: SortKey;
  sortKey: SortKey;
  sortDir: 1 | -1;
  onClick: (k: SortKey) => void;
}) {
  const active = sortKey === k;
  return (
    <th className="px-4 py-3">
      <button
        onClick={() => onClick(k)}
        className={`flex items-center gap-1 font-medium uppercase tracking-wide ${
          active ? "text-teal-700" : "text-slate-500"
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (sortDir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}
