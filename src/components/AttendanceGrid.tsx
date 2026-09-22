"use client";

import { useMemo, useState, useTransition } from "react";
import { updateAttendanceRow, type EventType } from "@/app/(app)/events/actions";
import PunishModal from "@/components/PunishModal";

type Row = {
  memberId: string;
  name: string;
  legion: string | null;
  lineupRole: "main" | "sub";
  signedUp: boolean;
  arrived: boolean;
  reason: string;
  isPunished: boolean;
};

type SortKey = "name" | "legion" | "signedUp" | "arrived";

const LEGIONS = ["Legion 1", "Legion 2"];

export default function AttendanceGrid({
  orgId,
  eventId,
  eventType,
  rows,
  isAdmin,
}: {
  orgId: string;
  eventId: string;
  eventType: EventType;
  rows: Row[];
  isAdmin: boolean;
}) {
  const showLegion = eventType !== "bear";
  const showPunish = eventType !== "bear";
  const showSignedUp = eventType !== "bear";
  const showReason = eventType !== "bear";
  const [search, setSearch] = useState("");
  const [legionFilter, setLegionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<1 | -1>(1);
  const [, startTransition] = useTransition();
  const [punishTarget, setPunishTarget] = useState<{ memberId: string; name: string; reason: string } | null>(
    null
  );

  const signedUpCount = rows.filter((r) => r.signedUp).length;
  const arrivedCount = rows.filter((r) => r.arrived).length;
  const didNotArriveCount = rows.filter((r) => r.signedUp && !r.arrived).length;

  const filtered = useMemo(() => {
    let list = rows;
    if (legionFilter !== "all") list = list.filter((r) => r.legion === legionFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.name.toLowerCase().includes(q));
    }
    return [...list].sort((a, b) => {
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name);
      if (sortKey === "legion") return sortDir * (a.legion ?? "").localeCompare(b.legion ?? "");
      if (sortKey === "signedUp") return sortDir * (Number(a.signedUp) - Number(b.signedUp));
      return sortDir * (Number(a.arrived) - Number(b.arrived));
    });
  }, [rows, legionFilter, search, sortKey, sortDir]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1));
    else {
      setSortKey(key);
      setSortDir(1);
    }
  }

  function save(memberId: string, patch: Partial<AttendanceFieldPatch>) {
    startTransition(() => {
      updateAttendanceRow({ orgId, eventId, eventType, memberId, ...patch });
    });
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <div className="relative flex-1 min-w-[160px]">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search members"
            className="w-full rounded-full border border-slate-200 bg-white py-1.5 px-3 text-sm focus:border-teal-500 focus:outline-none"
          />
        </div>
        {showLegion && (
          <select
            value={legionFilter}
            onChange={(e) => setLegionFilter(e.target.value)}
            className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:border-teal-500 focus:outline-none"
          >
            <option value="all">All legions</option>
            {LEGIONS.map((l) => (
              <option key={l} value={l}>
                {l}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className={`grid gap-3 px-5 py-4 sm:max-w-md ${showSignedUp ? "grid-cols-3" : "grid-cols-2"}`}>
        {showSignedUp && <Stat label="Signed up" value={signedUpCount} tone="slate" />}
        <Stat label="Arrived" value={arrivedCount} tone="emerald" />
        <Stat label="Did not arrive" value={didNotArriveCount} tone="red" />
      </div>

      <table className="w-full text-left text-sm">
        <thead className="border-t border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <Th label="Member" k="name" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            {showLegion && (
              <Th label="Legion" k="legion" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            )}
            {showLegion && <th className="px-4 py-2">Main / Sub</th>}
            {showSignedUp && (
              <Th label="Signed up" k="signedUp" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            )}
            <Th label="Arrival" k="arrived" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
            {showReason && <th className="px-4 py-2">Reason if absent</th>}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {filtered.map((r) => (
            <tr key={r.memberId}>
              <td className="px-4 py-3 align-top">
                <p className="font-medium text-slate-900">{r.name}</p>
                {showPunish && isAdmin && (
                  <button
                    disabled={r.isPunished}
                    onClick={() =>
                      setPunishTarget({
                        memberId: r.memberId,
                        name: r.name,
                        reason: r.reason || "No reason given",
                      })
                    }
                    className="mt-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-800 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {r.isPunished ? "Punished" : "Punish"}
                  </button>
                )}
              </td>
              {showLegion && (
                <td className="px-4 py-3 align-top">
                  {isAdmin ? (
                    <select
                      key={`legion-${r.memberId}-${r.legion ?? ""}`}
                      defaultValue={r.legion ?? ""}
                      onChange={(e) => save(r.memberId, { legion: e.target.value })}
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
                    >
                      <option value="">—</option>
                      {LEGIONS.map((l) => (
                        <option key={l} value={l}>
                          {l}
                        </option>
                      ))}
                    </select>
                  ) : (
                    r.legion ?? "—"
                  )}
                </td>
              )}
              {showLegion && (
                <td className="px-4 py-3 align-top">
                  {isAdmin ? (
                    <select
                      key={`lineup-${r.memberId}-${r.lineupRole}`}
                      defaultValue={r.lineupRole}
                      onChange={(e) =>
                        save(r.memberId, { lineupRole: e.target.value as "main" | "sub" })
                      }
                      className="rounded-full border border-slate-200 px-2 py-1 text-xs capitalize focus:border-teal-500 focus:outline-none"
                    >
                      <option value="main">Main</option>
                      <option value="sub">Sub</option>
                    </select>
                  ) : (
                    <span className="capitalize">{r.lineupRole}</span>
                  )}
                </td>
              )}
              {showSignedUp && (
                <td className="px-4 py-3 align-top">
                  {isAdmin ? (
                    <label className="flex items-center gap-1.5 text-xs text-slate-600">
                      <input
                        key={`signedup-${r.memberId}-${r.signedUp}`}
                        type="checkbox"
                        defaultChecked={r.signedUp}
                        onChange={(e) => save(r.memberId, { signedUp: e.target.checked })}
                        className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                      />
                      Signed up
                    </label>
                  ) : r.signedUp ? (
                    "Signed up"
                  ) : (
                    "—"
                  )}
                </td>
              )}
              <td className="px-4 py-3 align-top">
                {isAdmin ? (
                  <select
                    key={`arrived-${r.memberId}-${r.arrived}`}
                    defaultValue={r.arrived ? "arrived" : "not_arrived"}
                    onChange={(e) => save(r.memberId, { arrived: e.target.value === "arrived" })}
                    className={`rounded-full border px-2 py-1 text-xs focus:outline-none ${
                      r.arrived
                        ? "border-emerald-200 text-emerald-700"
                        : "border-red-200 text-red-700"
                    }`}
                  >
                    <option value="arrived">Arrived</option>
                    <option value="not_arrived">Did not arrive</option>
                  </select>
                ) : (
                  <span className={r.arrived ? "text-emerald-700" : "text-red-700"}>
                    {r.arrived ? "Arrived" : "Did not arrive"}
                  </span>
                )}
              </td>
              {showReason && (
                <td className="px-4 py-3 align-top">
                  {isAdmin ? (
                    <ReasonInput
                      key={`reason-${r.memberId}-${r.reason}`}
                      initial={r.reason}
                      disabled={r.arrived}
                      onCommit={(value) => save(r.memberId, { reason: value })}
                    />
                  ) : (
                    r.reason || "—"
                  )}
                </td>
              )}
            </tr>
          ))}
          {filtered.length === 0 && (
            <tr>
              <td
                colSpan={2 + (showLegion ? 2 : 0) + (showSignedUp ? 1 : 0) + (showReason ? 1 : 0)}
                className="px-4 py-8 text-center text-slate-400"
              >
                No members match.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {punishTarget && (
        <PunishModal
          orgId={orgId}
          eventType={eventType}
          memberId={punishTarget.memberId}
          memberName={punishTarget.name}
          defaultReason={punishTarget.reason}
          onClose={() => setPunishTarget(null)}
          onDone={() => setPunishTarget(null)}
        />
      )}
    </div>
  );
}

type AttendanceFieldPatch = {
  legion: string;
  lineupRole: "main" | "sub";
  signedUp: boolean;
  arrived: boolean;
  reason: string;
};

function ReasonInput({
  initial,
  disabled,
  onCommit,
}: {
  initial: string;
  disabled: boolean;
  onCommit: (value: string) => void;
}) {
  const [value, setValue] = useState(initial);

  if (disabled) {
    return <span className="text-slate-300">—</span>;
  }

  return (
    <input
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={() => {
        if (value !== initial) onCommit(value);
      }}
      placeholder="Reason or excuse"
      className="w-40 rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-teal-500 focus:outline-none"
    />
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "slate" | "emerald" | "red" }) {
  const toneClass =
    tone === "emerald" ? "text-emerald-600" : tone === "red" ? "text-red-600" : "text-slate-900";
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${toneClass}`}>{value}</p>
    </div>
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
    <th className="px-4 py-2">
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
