"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportBearResults, type BearResultImportRow } from "@/app/(app)/events/actions";
import { guessMemberId, type MatchableMember } from "@/lib/memberMatch";

function parseCsv(text: string): BearResultImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const looksLikeHeader = header.includes("name") || header.includes("chief") || header.includes("score");
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  return dataLines
    .map((line) => {
      const cols = line.split(/,|\t/).map((c) => c.trim());
      return {
        nameOrChiefId: cols[0] ?? "",
        score: Number((cols[1] ?? "").replace(/,/g, "")),
      };
    })
    .filter((r) => r.nameOrChiefId);
}

type Row = BearResultImportRow & { guessedMemberId?: string | null };

export default function BearResultsImportClient({
  orgId,
  eventId,
  members,
}: {
  orgId: string;
  eventId: string;
  members: MatchableMember[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseCsv(String(reader.result ?? ""));
      setRows(
        parsed.map((r) => {
          const guessedMemberId = guessMemberId(r.nameOrChiefId, members);
          return { ...r, memberId: guessedMemberId, guessedMemberId };
        })
      );
      setStatus(null);
    };
    reader.readAsText(file);
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  function removeRow(i: number) {
    setRows((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleImport() {
    setImporting(true);
    const payload = rows.map((r) => ({
      ...r,
      manualMatch: r.memberId !== r.guessedMemberId,
    }));
    const result = await bulkImportBearResults(orgId, eventId, payload);
    setImporting(false);
    setStatus(
      `Imported ${result.imported} row${result.imported === 1 ? "" : "s"}.` +
        (result.unmatched ? ` ${result.unmatched} skipped (no member picked or no valid score).` : "")
    );
    setRows([]);
    router.refresh();
  }

  return (
    <details>
      <summary className="cursor-pointer text-xs font-medium text-teal-700 hover:underline">
        + Import results from CSV
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">Columns: name or Chief ID, score. A header row is optional.</p>
        <input type="file" accept=".csv,.tsv,text/csv" onChange={handleFile} className="text-sm" />

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">From file</th>
                  <th className="px-2 py-1.5">Member</th>
                  <th className="px-2 py-1.5">Score</th>
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
                        className={`w-36 rounded border px-1.5 py-0.5 ${
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
                        value={r.score}
                        onChange={(e) => updateRow(i, { score: Number(e.target.value) || 0 })}
                        className="w-24 rounded border border-slate-200 px-1.5 py-0.5"
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
