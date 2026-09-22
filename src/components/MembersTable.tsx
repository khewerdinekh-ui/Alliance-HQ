"use client";

import { useMemo, useState } from "react";
import { deleteMember, toggleMemberStatus } from "@/app/(app)/members/actions";

type Member = {
  id: string;
  name: string;
  chief_id: string | null;
  power: number | null;
  level: number | null;
  alliance_rank: string;
  status: string;
  allianceName: string;
  overallPct: number;
};

const RANK_COLORS: Record<string, string> = {
  R5: "bg-amber-50 text-amber-700",
  R4: "bg-violet-50 text-violet-700",
  R3: "bg-teal-50 text-teal-700",
  R2: "bg-sky-50 text-sky-700",
  R1: "bg-slate-100 text-slate-600",
};

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase();
}

function formatPower(power: number | null) {
  if (!power) return "—";
  return power.toLocaleString();
}

type SortKey = "name" | "overallPct" | "power";

export default function MembersTable({
  members,
  allianceNames,
  isAdmin,
}: {
  members: Member[];
  allianceNames: string[];
  isAdmin: boolean;
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"current" | "old" | "all">("current");
  const [allianceFilter, setAllianceFilter] = useState<string>("all");
  const [rankFilter, setRankFilter] = useState<string>("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const filtered = useMemo(() => {
    let rows = members;
    if (statusFilter !== "all") rows = rows.filter((m) => m.status === statusFilter);
    if (allianceFilter !== "all") rows = rows.filter((m) => m.allianceName === allianceFilter);
    if (rankFilter !== "all") rows = rows.filter((m) => m.alliance_rank === rankFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (m) => m.name.toLowerCase().includes(q) || (m.chief_id ?? "").includes(q)
      );
    }
    const sorted = [...rows].sort((a, b) => {
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name);
      if (sortKey === "power") return sortDir * ((a.power ?? 0) - (b.power ?? 0));
      return sortDir * (a.overallPct - b.overallPct);
    });
    return sorted;
  }, [members, statusFilter, allianceFilter, rankFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

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
            placeholder="Search members"
            className="w-full rounded-full border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        <Select value={statusFilter} onChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <option value="current">Current members</option>
          <option value="old">Old members</option>
          <option value="all">All members</option>
        </Select>

        <Select value={allianceFilter} onChange={setAllianceFilter}>
          <option value="all">All alliances</option>
          {allianceNames.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </Select>

        <Select value={rankFilter} onChange={setRankFilter}>
          <option value="all">All ranks</option>
          {["R1", "R2", "R3", "R4", "R5"].map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <SortableTh label="Member" active={sortKey === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
              <th className="px-4 py-3">Alliance</th>
              <th className="px-4 py-3">Chief ID</th>
              <SortableTh label="Power" active={sortKey === "power"} dir={sortDir} onClick={() => toggleSort("power")} />
              <th className="px-4 py-3">Level</th>
              <SortableTh
                label="Overall %"
                active={sortKey === "overallPct"}
                dir={sortDir}
                onClick={() => toggleSort("overallPct")}
              />
              <th className="px-4 py-3">Rank</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-teal-800 text-xs font-semibold text-white">
                      {initials(m.name)}
                    </div>
                    <span className="font-medium text-slate-900">{m.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">{m.allianceName || "—"}</td>
                <td className="px-4 py-3 text-slate-600">{m.chief_id || "Not added"}</td>
                <td className="px-4 py-3 text-slate-600">{formatPower(m.power)}</td>
                <td className="px-4 py-3 text-slate-600">{m.level ?? "—"}</td>
                <td className="px-4 py-3 font-medium text-violet-600">
                  {m.overallPct.toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      RANK_COLORS[m.alliance_rank] ?? "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {m.alliance_rank}
                  </span>
                </td>
                {isAdmin && (
                  <td className="relative px-4 py-3 text-right">
                    <button
                      onClick={() => setOpenMenu(openMenu === m.id ? null : m.id)}
                      className="rounded-md px-2 py-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      aria-label="Actions"
                    >
                      ⋯
                    </button>
                    {openMenu === m.id && (
                      <div className="absolute right-4 top-10 z-10 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 text-left shadow-lg">
                        <form action={toggleMemberStatus}>
                          <input type="hidden" name="id" value={m.id} />
                          <input
                            type="hidden"
                            name="nextStatus"
                            value={m.status === "current" ? "old" : "current"}
                          />
                          <button className="block w-full px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50">
                            {m.status === "current" ? "Mark old" : "Mark current"}
                          </button>
                        </form>
                        <form action={deleteMember}>
                          <input type="hidden" name="id" value={m.id} />
                          <button className="block w-full px-3 py-1.5 text-left text-xs text-red-600 hover:bg-red-50">
                            Delete
                          </button>
                        </form>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={isAdmin ? 8 : 7} className="px-4 py-8 text-center text-slate-400">
                  No members match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: 1 | -1;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3">
      <button
        onClick={onClick}
        className={`flex items-center gap-1 font-medium uppercase tracking-wide ${
          active ? "text-teal-700" : "text-slate-500"
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === 1 ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
    >
      {children}
    </select>
  );
}
