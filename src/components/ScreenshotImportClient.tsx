"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkImportAttendance,
  extractAttendanceScreenshot,
  type EventType,
} from "@/app/(app)/events/actions";
import { resizeImageDataUrl } from "@/lib/imageResize";
import { guessMemberId, type MatchableMember } from "@/lib/memberMatch";

type Row = {
  nameOrChiefId: string;
  signedUp: boolean;
  arrived: boolean;
  reason: string;
  memberId: string | null;
};

// A slow AI extraction that never resolves would leave the UI stuck on
// "Reading…" forever with no feedback — race it against a timeout instead.
const EXTRACT_TIMEOUT_MS = 45000;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("This is taking too long. Try fewer screenshots or check your connection.")),
      ms
    );
    promise.then(
      (v) => {
        clearTimeout(timer);
        resolve(v);
      },
      (e) => {
        clearTimeout(timer);
        reject(e);
      }
    );
  });
}

export default function ScreenshotImportClient({
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
  const [images, setImages] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    setStatus(null);
    try {
      const dataUrls = await Promise.all(files.map((f) => resizeImageDataUrl(f)));
      setImages(dataUrls);
      setRows([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    }
  }

  async function handleExtract() {
    setExtracting(true);
    setError(null);
    try {
      const result = await withTimeout(extractAttendanceScreenshot(images), EXTRACT_TIMEOUT_MS);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRows(result.rows.map((r) => ({ ...r, memberId: guessMemberId(r.nameOrChiefId, members) })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
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
        (result.unmatched ? ` ${result.unmatched} skipped (no member picked).` : "")
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
                  <th className="px-2 py-1.5">AI read</th>
                  <th className="px-2 py-1.5">Member</th>
                  <th className="px-2 py-1.5">Signed up</th>
                  <th className="px-2 py-1.5">Arrived</th>
                  <th className="px-2 py-1.5">Reason</th>
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
                        className={`w-28 rounded border px-1.5 py-0.5 ${
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
