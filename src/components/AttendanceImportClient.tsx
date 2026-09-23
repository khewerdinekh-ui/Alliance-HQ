"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportAttendance, type AttendanceImportRow, type EventType } from "@/app/(app)/events/actions";

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
}: {
  orgId: string;
  eventId: string;
  eventType: EventType;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<AttendanceImportRow[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);
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
    const result = await bulkImportAttendance(orgId, eventId, eventType, rows);
    setImporting(false);
    setStatus(
      `Imported ${result.imported} row${result.imported === 1 ? "" : "s"}.` +
        (result.unmatched ? ` ${result.unmatched} didn't match a member.` : "")
    );
    setUnmatchedNames(result.unmatchedNames ?? []);
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
        {unmatchedNames.length > 0 && (
          <p className="text-xs text-red-600">Didn't match: {unmatchedNames.join(", ")}</p>
        )}
      </div>
    </details>
  );
}
