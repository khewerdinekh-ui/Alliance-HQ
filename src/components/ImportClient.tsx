"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportMembers, type ImportRow } from "@/app/(app)/import/actions";

function parseCsv(text: string): ImportRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const header = lines[0].toLowerCase();
  const looksLikeHeader = header.includes("name") && !/^\d/.test(header);
  const dataLines = looksLikeHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const cols = line.split(",").map((c) => c.trim());
    return {
      name: cols[0] ?? "",
      chiefId: cols[1] ?? "",
      alliance: cols[2] ?? "",
      rank: cols[3] ?? "",
      power: cols[4] ?? "",
      level: cols[5] ?? "",
    };
  });
}

export default function ImportClient() {
  const router = useRouter();
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRows(parseCsv(String(reader.result ?? "")));
      setStatus(null);
    };
    reader.readAsText(file);
  }

  function handlePaste(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setRows(parseCsv(e.target.value));
    setStatus(null);
  }

  async function handleImport() {
    setImporting(true);
    const result = await bulkImportMembers(rows);
    setImporting(false);
    if (result.error) {
      setStatus(result.error);
    } else {
      setStatus(`Imported ${result.imported} member${result.imported === 1 ? "" : "s"}.`);
      setRows([]);
      router.refresh();
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Upload a CSV file</h2>
        <p className="mt-1 text-xs text-slate-500">
          Columns: name, chief_id, alliance, rank, power, level. A header row is optional.
        </p>
        <input
          type="file"
          accept=".csv,text/csv"
          onChange={handleFile}
          className="mt-3 text-sm"
        />

        <p className="mt-4 text-xs text-slate-500">Or paste CSV rows directly:</p>
        <textarea
          rows={6}
          onChange={handlePaste}
          placeholder="name,chief_id,alliance,rank,power,level"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
        />
      </div>

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <h3 className="text-sm font-semibold text-slate-900">
              Preview — {rows.length} row{rows.length === 1 ? "" : "s"}
            </h3>
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {importing ? "Importing…" : "Import all"}
            </button>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-2">Name</th>
                <th className="px-4 py-2">Chief ID</th>
                <th className="px-4 py-2">Alliance</th>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Power</th>
                <th className="px-4 py-2">Level</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i}>
                  <td className="px-4 py-2">{r.name}</td>
                  <td className="px-4 py-2">{r.chiefId}</td>
                  <td className="px-4 py-2">{r.alliance}</td>
                  <td className="px-4 py-2">{r.rank}</td>
                  <td className="px-4 py-2">{r.power}</td>
                  <td className="px-4 py-2">{r.level}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 20 && (
            <p className="px-4 py-2 text-xs text-slate-400">
              …and {rows.length - 20} more rows.
            </p>
          )}
        </div>
      )}

      {status && <p className="text-sm text-slate-700">{status}</p>}
    </div>
  );
}
