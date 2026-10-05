"use client";

import { useMemo, useState } from "react";
import { updateTroopRow, type TroopPatch } from "@/app/(app)/troops/actions";

type Row = {
  memberId: string;
  name: string;
  infantry: string;
  lancers: string;
  marksmen: string;
  slot1: boolean;
  slot2: boolean;
  slot3: boolean;
  status: string;
};

const SLOTS = [
  { key: "slot1", label: "12-14 UTC" },
  { key: "slot2", label: "14-16 UTC" },
  { key: "slot3", label: "15-17 UTC" },
] as const;

const STATUSES = ["Unavailable"];

// "T11(10)" = tier 11, level 10; "N(9)" = no tier yet, level 9.
const TIERS = ["T12", "T11", "N"];
const TROOP_OPTIONS = TIERS.flatMap((tier) =>
  Array.from({ length: 4 }, (_, i) => `${tier}(${10 - i})`)
);

// T12 red, T11 at level 10 dark green, T11 lower light green, the rest grey —
// same colour code the alliance's sheet uses.
function troopTone(value: string) {
  if (!value) return "bg-slate-100 text-slate-500";
  if (value.startsWith("T12")) return "bg-red-700 text-white";
  if (value.startsWith("T11(10)")) return "bg-emerald-700 text-white";
  if (value.startsWith("T11")) return "bg-lime-200 text-emerald-900";
  return "bg-slate-100 text-slate-700";
}

const TROOP_COLUMNS = [
  { key: "infantry", label: "Infantry" },
  { key: "lancers", label: "Lancers" },
  { key: "marksmen", label: "Marksmen" },
] as const;

export default function TroopsGrid({ rows: initialRows, isAdmin }: { rows: Row[]; isAdmin: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (slotFilter === "unavailable") return r.status === "Unavailable";
      if (slotFilter !== "all") {
        return r.status !== "Unavailable" && r[slotFilter as "slot1" | "slot2" | "slot3"];
      }
      return true;
    });
  }, [rows, search, slotFilter]);

  async function save(memberId: string, patch: Partial<Row>) {
    const before = rows;
    setRows((prev) => prev.map((r) => (r.memberId === memberId ? { ...r, ...patch } : r)));
    setError(null);
    const { memberId: _m, name: _n, ...fields } = patch as Partial<Row> & { memberId?: string; name?: string };
    const res = await updateTroopRow(memberId, fields as TroopPatch);
    if (res.error) {
      setRows(before);
      setError(res.error);
    }
  }

  const available = (key: "slot1" | "slot2" | "slot3") =>
    rows.filter((r) => r[key] && r.status !== "Unavailable").length;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members"
          className="min-w-[160px] flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        <select
          value={slotFilter}
          onChange={(e) => setSlotFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="all">Everyone</option>
          {SLOTS.map((s) => (
            <option key={s.key} value={s.key}>
              Available {s.label}
            </option>
          ))}
          <option value="unavailable">Unavailable</option>
        </select>
      </div>

      <div className="flex flex-wrap gap-2 px-5 py-3 text-xs text-slate-600">
        {SLOTS.map((s) => (
          <span key={s.key} className="rounded-full bg-slate-100 px-3 py-1">
            {s.label}: <strong>{available(s.key)}</strong> available
          </span>
        ))}
        <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
          Unavailable: <strong>{rows.filter((r) => r.status === "Unavailable").length}</strong>
        </span>
      </div>

      {error && <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-t border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Member</th>
              {TROOP_COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2">
                  {c.label}
                </th>
              ))}
              {SLOTS.map((s) => (
                <th key={s.key} className="px-2 py-2 text-center">
                  {s.label}
                </th>
              ))}
              <th className="px-2 py-2">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.memberId}>
                <td className="px-4 py-1.5 font-medium text-slate-900">{r.name}</td>
                {TROOP_COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    {isAdmin ? (
                      <select
                        value={r[c.key]}
                        onChange={(e) => save(r.memberId, { [c.key]: e.target.value })}
                        className={`w-24 rounded-full border-0 px-2 py-1 text-xs font-medium ${troopTone(r[c.key])}`}
                      >
                        <option value=""></option>
                        {TROOP_OPTIONS.map((o) => (
                          <option key={o} value={o} className="bg-white text-slate-900">
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block w-24 rounded-full px-2 py-1 text-center text-xs font-medium ${troopTone(r[c.key])}`}>
                        {r[c.key] || "—"}
                      </span>
                    )}
                  </td>
                ))}
                {SLOTS.map((s) => (
                  <td key={s.key} className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={r[s.key]}
                      disabled={!isAdmin}
                      onChange={(e) => save(r.memberId, { [s.key]: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  {isAdmin ? (
                    <select
                      value={r.status}
                      onChange={(e) => save(r.memberId, { status: e.target.value })}
                      className={`w-28 rounded-full border-0 px-2 py-1 text-xs font-medium ${
                        r.status === "Unavailable" ? "bg-red-700 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <option value=""></option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-white text-slate-900">
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    r.status && (
                      <span className="rounded-full bg-red-700 px-2 py-1 text-xs font-medium text-white">{r.status}</span>
                    )
                  )}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-center text-sm text-slate-400">
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
