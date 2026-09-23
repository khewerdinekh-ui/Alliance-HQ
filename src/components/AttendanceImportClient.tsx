"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportAttendance, type AttendanceImportRow, type EventType } from "@/app/(app)/events/actions";
import { guessMemberId, type MatchableMember } from "@/lib/memberMatch";

function parseBool(value: string) {
  const v = value.trim().toLowerCase();
  return v === "true" || v === "yes" || v === "1" || v === "y";
}

function parseCsv(text: string): AttendanceImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const looksLikeHeader = header.includes("name") || header.includes("chief");
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cols = line.split(/,|\t/).map((c) => c.trim());
    return {
      nameOrChiefId: cols[0] ?? "",
      signedUp: cols[1] !== undefined ? parseBool(cols[1]) : true,
      arrived: cols[2] !== undefined ? parseBool(cols[2]) : false,
      reason: cols[3] ?? "",
      legion: cols[4] ?? "",
      lineupRole: (cols[5]?.toLowerCase() === "sub" ? "sub" : "main") as "main" | "sub",
    };
  });
}

export default function AttendanceImportClient({
  orgId,
  eventId,
  eventType,
  members,
}: {
  orgId: string;
  eventId: string;
  eventType: EventType;
  members: MatchableMember[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AttendanceImportRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      setRows(parsed.map((r) => ({ ...r, memberId: guessMemberId(r.nameOrChiefId, members) })));
      setStatus(null);
    };
    reader.readAsText(file);
  }

  function updateRow(i: number, patch: Partial<AttendanceImportRow>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleImport() {
    setImporting(true);
    const result = await bulkImportAttendance(orgId, eventId, eventType, rows);
    setImporting(false);
    setStatus(
      `Imported ${result.imported} row${result.imported === 1 ? "" : "s"}.` +
        (result.unmatched ? ` ${result.unmatched} skipped (no member picked).` : "")
    );
    setRows([]);
    router.refresh();
  }

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-teal-700 hover:underline">
        + Import attendance from CSV
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          Columns: name or Chief ID, signed up (true/false), arrived (true/false), reason, legion,
          main/sub. A header row is optional.
        </p>
        <input type="file" accept=".csv,.tsv,text/csv" onChange={handleFile} className="text-sm" />

        {rows.length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">From file</th>
                  <th className="px-2 py-1.5">Member</th>
                  <th className="px-2 py-1.5">Arrived</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i} className={r.memberId ? "" : "bg-red-50/60"}>
                    <td className="px-2 py-1 text-slate-500">{r.nameOrChiefId}</td>
                    <td className="px-2 py-1">
                      <select
                        value={r.memberId ?? ""}
                        onChange={(e) => updateRow(i, { memberId: e.target.value || null })}
                        className={`w-32 rounded border px-1.5 py-0.5 ${
                          r.memberId ? "border-slate-200" : "border-red-300"
                        }`}
                      >
                        <option value="">— no match —</option>
                        {members.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={r.arrived ?? false}
                        onChange={(e) => updateRow(i, { arrived: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <button onClick={() => removeRow(i)} className="text-red-500">
                        ✕
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
              <span className="text-[11px] text-slate-500">
                {rows.length} row{rows.length === 1 ? "" : "s"} — review before importing
                {rows.some((r) => !r.memberId) ? " (red rows need a member picked)" : ""}
              </span>
              <button
                onClick={handleImport}
                disabled={importing}
                className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
              >
                {importing ? "Importing…" : "Import"}
              </button>
            </div>
          </div>
        )}

        {status && <p className="text-xs text-slate-600">{status}</p>}
      </div>
    </details>
  );
}
