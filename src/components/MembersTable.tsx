"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteMember, updateMemberField } from "@/app/(app)/members/actions";
import MemberModal, { type EditableMember } from "@/components/MemberModal";
import StatCard from "@/components/StatCard";
import ExportTableModal from "@/components/ExportTableModal";

type Member = {
  id: string;
  name: string;
  chief_id: string | null;
  power: number | null;
  level: number | null;
  alliance_rank: string;
  status: string;
  sub_alliance_id: string | null;
  allianceName: string;
  aliases: string[];
  joined_at: string | null;
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
  orgId,
  members,
  subAlliances,
  isAdmin,
  statLabels,
}: {
  orgId: string;
  members: Member[];
  subAlliances: { id: string; name: string }[];
  isAdmin: boolean;
  statLabels: { total: string; current: string; old: string; alliances: string };
}) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"current" | "old" | "all">("current");
  const [allianceFilter, setAllianceFilter] = useState<string>("all");
  const [rankFilter, setRankFilter] = useState<string>("all");
  // Overall attendance % range — blank means no limit on that side.
  const [exportOpen, setExportOpen] = useState(false);
  const [minPct, setMinPct] = useState("");
  const [maxPct, setMaxPct] = useState("");
  const minVal = minPct.trim() === "" ? null : Number(minPct);
  const maxVal = maxPct.trim() === "" ? null : Number(maxPct);
  const pctOk = (p: number) =>
    (minVal == null || Number.isNaN(minVal) || p >= minVal) &&
    (maxVal == null || Number.isNaN(maxVal) || p <= maxVal);
  const [chiefIdFilter, setChiefIdFilter] = useState<"all" | "has" | "missing">("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [modalMember, setModalMember] = useState<EditableMember | "new" | null>(null);

  const allianceNames = subAlliances.map((a) => a.name);

  // Everything except the status filter — the stat cards count from this so
  // they follow the search/alliance/rank/Chief ID filters, while still
  // splitting current vs old.
  const base = useMemo(() => {
    let rows = members;
    if (allianceFilter !== "all") rows = rows.filter((m) => m.allianceName === allianceFilter);
    if (rankFilter !== "all") rows = rows.filter((m) => m.alliance_rank === rankFilter);
    rows = rows.filter((m) => pctOk(m.overallPct));
    if (chiefIdFilter === "has") rows = rows.filter((m) => !!m.chief_id);
    if (chiefIdFilter === "missing") rows = rows.filter((m) => !m.chief_id);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          (m.chief_id ?? "").includes(q) ||
          m.aliases.some((a) => a.toLowerCase().includes(q))
      );
    }
    return rows;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, allianceFilter, rankFilter, chiefIdFilter, search, minPct, maxPct]);

  const filtered = useMemo(() => {
    const rows = statusFilter === "all" ? base : base.filter((m) => m.status === statusFilter);
    return [...rows].sort((a, b) => {
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name);
      if (sortKey === "power") return sortDir * ((a.power ?? 0) - (b.power ?? 0));
      return sortDir * (a.overallPct - b.overallPct);
    });
  }, [base, statusFilter, sortKey, sortDir]);

  // Members per alliance under the current status/rank/Chief ID/search
  // filters (the alliance filter itself is ignored so every alliance shows).
  const allianceCounts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const counts = new Map<string, number>();
    for (const m of members) {
      if (statusFilter !== "all" && m.status !== statusFilter) continue;
      if (rankFilter !== "all" && m.alliance_rank !== rankFilter) continue;
      if (!pctOk(m.overallPct)) continue;
      if (chiefIdFilter === "has" && !m.chief_id) continue;
      if (chiefIdFilter === "missing" && m.chief_id) continue;
      if (
        q &&
        !(
          m.name.toLowerCase().includes(q) ||
          (m.chief_id ?? "").includes(q) ||
          m.aliases.some((a) => a.toLowerCase().includes(q))
        )
      )
        continue;
      const key = m.allianceName || "";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return counts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [members, statusFilter, rankFilter, chiefIdFilter, search, minPct, maxPct]);

  const stats = {
    total: base.length,
    current: base.filter((m) => m.status === "current").length,
    old: base.filter((m) => m.status === "old").length,
    alliances: new Set(base.map((m) => m.allianceName).filter(Boolean)).size,
  };

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 1 ? -1 : 1));
    } else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function toEditable(m: Member): EditableMember {
    return {
      id: m.id,
      name: m.name,
      chief_id: m.chief_id,
      power: m.power,
      level: m.level,
      alliance_rank: m.alliance_rank,
      status: m.status,
      sub_alliance_id: m.sub_alliance_id,
      aliases: m.aliases,
      joined_at: m.joined_at,
    };
  }

  return (
    <div>
      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label={statLabels.total} value={stats.total} accent="teal" />
        <StatCard label={statLabels.current} value={stats.current} accent="violet" />
        <StatCard label={statLabels.old} value={stats.old} accent="slate" />
        <StatCard label={statLabels.alliances} value={stats.alliances} accent="amber" />
      </div>

      <div className="mb-6 flex flex-wrap gap-2 text-sm">
        {allianceNames.map((a) => (
          <button
            key={a}
            onClick={() => setAllianceFilter(allianceFilter === a ? "all" : a)}
            className={`rounded-full border px-3 py-1 transition ${
              allianceFilter === a
                ? "border-teal-500 bg-teal-50 text-teal-800"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {a} <strong>{allianceCounts.get(a) ?? 0}</strong>
          </button>
        ))}
        {(allianceCounts.get("") ?? 0) > 0 && (
          <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-500">
            No alliance <strong>{allianceCounts.get("")}</strong>
          </span>
        )}
      </div>

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

        <Select value={chiefIdFilter} onChange={(v) => setChiefIdFilter(v as typeof chiefIdFilter)}>
          <option value="all">All Chief IDs</option>
          <option value="has">Has Chief ID</option>
          <option value="missing">No Chief ID</option>
        </Select>

        <Select value={allianceFilter} onChange={setAllianceFilter}>
          <option value="all">All alliances</option>
          {allianceNames.map((a) => (
            <option key={a} value={a}>
              {a} ({allianceCounts.get(a) ?? 0})
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

        <div className="flex items-center gap-1.5 text-sm text-slate-600">
          <span>Attendance</span>
          <input
            type="number"
            min={0}
            max={100}
            value={minPct}
            onChange={(e) => setMinPct(e.target.value)}
            placeholder="over %"
            aria-label="Minimum attendance percentage"
            className="w-20 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
          <span>to</span>
          <input
            type="number"
            min={0}
            max={100}
            value={maxPct}
            onChange={(e) => setMaxPct(e.target.value)}
            placeholder="under %"
            aria-label="Maximum attendance percentage"
            className="w-20 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>

        <button
          onClick={() => setExportOpen(true)}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          Copy for Discord
        </button>

        {isAdmin && (
          <button
            onClick={() => setModalMember("new")}
            className="ml-auto flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-600/30 transition hover:bg-teal-700"
          >
            <span className="text-base leading-none">+</span> Add member
          </button>
        )}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[760px] text-left text-sm">
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
              <tr key={m.id} className="group hover:bg-slate-50/60">
                <td className="px-4 py-3">
                  <button
                    onClick={() => isAdmin && setModalMember(toEditable(m))}
                    className="flex items-center gap-2.5 text-left"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-800 to-teal-800 text-xs font-semibold text-white">
                      {initials(m.name)}
                    </div>
                    <span className="font-medium text-slate-900 group-hover:text-teal-700">
                      {m.name}
                    </span>
                  </button>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {isAdmin ? (
                    <InlineSelect
                      id={m.id}
                      field="sub_alliance_id"
                      value={m.sub_alliance_id ?? ""}
                      display={m.allianceName || "—"}
                    >
                      <option value="">No alliance</option>
                      {subAlliances.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </InlineSelect>
                  ) : (
                    m.allianceName || "—"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {isAdmin ? (
                    <InlineText
                      id={m.id}
                      field="chief_id"
                      value={m.chief_id ?? ""}
                      display={m.chief_id || "Not added"}
                    />
                  ) : (
                    m.chief_id || "Not added"
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {isAdmin ? (
                    <InlineText
                      id={m.id}
                      field="power"
                      value={m.power != null ? String(m.power) : ""}
                      display={formatPower(m.power)}
                    />
                  ) : (
                    formatPower(m.power)
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {isAdmin ? (
                    <InlineText
                      id={m.id}
                      field="level"
                      value={m.level != null ? String(m.level) : ""}
                      display={m.level != null ? String(m.level) : "—"}
                    />
                  ) : (
                    m.level ?? "—"
                  )}
                </td>
                <td className="px-4 py-3 font-medium text-violet-600">
                  {m.overallPct.toFixed(1)}%
                </td>
                <td className="px-4 py-3">
                  {isAdmin ? (
                    <InlineSelect
                      id={m.id}
                      field="alliance_rank"
                      value={m.alliance_rank}
                      display={m.alliance_rank}
                      badgeClass={RANK_COLORS[m.alliance_rank] ?? "bg-slate-100 text-slate-600"}
                    >
                      {["R1", "R2", "R3", "R4", "R5"].map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </InlineSelect>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        RANK_COLORS[m.alliance_rank] ?? "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {m.alliance_rank}
                    </span>
                  )}
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
                        <button
                          onClick={() => {
                            setModalMember(toEditable(m));
                            setOpenMenu(null);
                          }}
                          className="block w-full px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-50"
                        >
                          Edit
                        </button>
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

      {modalMember && (
        <MemberModal
          orgId={orgId}
          subAlliances={subAlliances}
          member={modalMember === "new" ? null : modalMember}
          onClose={() => setModalMember(null)}
        />
      )}
      {exportOpen && <ExportTableModal rows={filtered} onClose={() => setExportOpen(false)} />}
    </div>
  );
}

function InlineText({
  id,
  field,
  value,
  display,
}: {
  id: string;
  field: string;
  value: string;
  display: string;
}) {
  const [editing, setEditing] = useState(false);
  const [local, setLocal] = useState(value);
  const [, startTransition] = useTransition();

  function commit() {
    setEditing(false);
    if (local !== value) {
      startTransition(() => {
        updateMemberField(id, field, local);
      });
    }
  }

  if (!editing) {
    return (
      <button
        onClick={() => setEditing(true)}
        className="rounded px-1.5 py-0.5 text-left hover:bg-slate-100"
      >
        {display}
      </button>
    );
  }

  return (
    <input
      autoFocus
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
        if (e.key === "Escape") {
          setLocal(value);
          setEditing(false);
        }
      }}
      className="w-24 rounded border border-teal-400 px-1.5 py-0.5 text-sm focus:outline-none"
    />
  );
}

function InlineSelect({
  id,
  field,
  value,
  display,
  badgeClass,
  children,
}: {
  id: string;
  field: string;
  value: string;
  display: string;
  badgeClass?: string;
  children: React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [, startTransition] = useTransition();

  if (!editing) {
    return (
      <button onClick={() => setEditing(true)} className="rounded text-left hover:opacity-80">
        {badgeClass ? (
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badgeClass}`}>
            {display}
          </span>
        ) : (
          <span className="px-1.5 py-0.5 hover:bg-slate-100">{display}</span>
        )}
      </button>
    );
  }

  return (
    <select
      autoFocus
      defaultValue={value}
      onChange={(e) => {
        setEditing(false);
        startTransition(() => {
          updateMemberField(id, field, e.target.value);
        });
      }}
      onBlur={() => setEditing(false)}
      className="rounded border border-teal-400 px-1.5 py-0.5 text-sm focus:outline-none"
    >
      {children}
    </select>
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
