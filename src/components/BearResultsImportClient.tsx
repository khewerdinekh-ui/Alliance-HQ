"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportBearResults, type BearResultImportRow } from "@/app/(app)/events/actions";

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

export default function BearResultsImportClient({ orgId, eventId }: { orgId: string; eventId: string }) {
  const router = useRouter();
  const [rows, setRows] = useState<BearResultImportRow[]>([]);
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

  async function handleImport() {
    setImporting(true);
    const result = await bulkImportBearResults(orgId, eventId, rows);
    setImporting(false);
    setStatus(
      `Imported ${result.imported} row${result.imported === 1 ? "" : "s"}.` +
        (result.unmatched ? ` ${result.unmatched} row(s) didn't match a member or score.` : "")
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
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-600">
              {rows.length} row{rows.length === 1 ? "" : "s"} ready.
            </p>
            <button
              onClick={handleImport}
              disabled={importing}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-teal-700 disabled:opacity-60"
            >
              {importing ? "Importing…" : "Import"}
            </button>
          </div>
        )}

        {status && <p className="text-xs text-slate-600">{status}</p>}
      </div>
    </details>
  );
}
