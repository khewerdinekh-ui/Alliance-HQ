"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkImportAttendance,
  extractAttendanceScreenshot,
  type EventType,
} from "@/app/(app)/events/actions";

type Row = {
  nameOrChiefId: string;
  signedUp: boolean;
  arrived: boolean;
  reason: string;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ScreenshotImportClient({
  orgId,
  eventId,
  eventType,
}: {
  orgId: string;
  eventId: string;
  eventType: EventType;
}) {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const dataUrls = await Promise.all(files.map(fileToDataUrl));
    setImages(dataUrls);
    setRows([]);
    setError(null);
    setStatus(null);
  }

  async function handleExtract() {
    setExtracting(true);
    setError(null);
    const result = await extractAttendanceScreenshot(images);
    setExtracting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setRows(result.rows);
  }

  function updateRow(i: number, patch: Partial<Row>) {
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
        (result.unmatched ? ` ${result.unmatched} name/Chief ID didn't match a member.` : "")
    );
    setRows([]);
    setImages([]);
    router.refresh();
  }

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-violet-700 hover:underline">
        + Import attendance from screenshot (AI)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          Upload one or more screenshots of a sign-up/attendance list. An AI model reads the names
          and statuses — always review before importing.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={handleFiles}
          className="text-sm"
        />

        {images.length > 0 && rows.length === 0 && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-violet-700 disabled:opacity-60"
          >
            {extracting ? "Reading screenshot…" : `Read ${images.length} screenshot(s)`}
          </button>
        )}

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Name / Chief ID</th>
                  <th className="px-2 py-1.5">Signed up</th>
                  <th className="px-2 py-1.5">Arrived</th>
                  <th className="px-2 py-1.5">Reason</th>
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr key={i}>
                    <td className="px-2 py-1">
                      <input
                        value={r.nameOrChiefId}
                        onChange={(e) => updateRow(i, { nameOrChiefId: e.target.value })}
                        className="w-28 rounded border border-slate-200 px-1.5 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={r.signedUp}
                        onChange={(e) => updateRow(i, { signedUp: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={r.arrived}
                        onChange={(e) => updateRow(i, { arrived: e.target.checked })}
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={r.reason}
                        onChange={(e) => updateRow(i, { reason: e.target.value })}
                        className="w-28 rounded border border-slate-200 px-1.5 py-0.5"
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
