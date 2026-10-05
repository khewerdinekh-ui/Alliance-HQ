"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkImportAttendance,
  extractAttendanceScreenshot,
  type AttendanceImportOptions,
  type EventType,
} from "@/app/(app)/events/actions";
import { resizeImageDataUrl } from "@/lib/imageResize";
import { extractVideoFrames } from "@/lib/videoFrames";
import { collapseRows, duplicateMemberIds } from "@/lib/collapseRows";
import { guessMemberId, type MatchableMember } from "@/lib/memberMatch";

type Row = {
  nameOrChiefId: string;
  signedUp: boolean;
  arrived: boolean;
  reason: string;
  score: number | null;
  lineupRole: "main" | "sub" | null;
  memberId: string | null;
  guessedMemberId: string | null;
};

// A slow AI extraction that never resolves would leave the UI stuck on
// "Reading…" forever with no feedback — race it against a timeout instead.
const EXTRACT_TIMEOUT_MS = 240000;
// Frames go to the server a couple at a time, one call after another, so no
// single call runs past the host's time limit or OpenAI's per-minute cap.
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 1500;
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
  options,
}: {
  orgId: string;
  eventId: string;
  eventType: EventType;
  members: MatchableMember[];
  options?: AttendanceImportOptions;
}) {
  const router = useRouter();
  const [images, setImages] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const dupes = duplicateMemberIds(rows);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    setStatus(null);
    try {
      const perFile = await Promise.all(
        files.map((f) => (f.type.startsWith("video/") ? extractVideoFrames(f, 24) : resizeImageDataUrl(f).then((u) => [u])))
      );
      setImages(perFile.flat());
      setRows([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    }
  }

  async function handleExtract() {
    setExtracting(true);
    setError(null);

    const batches: string[][] = [];
    for (let i = 0; i < images.length; i += BATCH_SIZE) batches.push(images.slice(i, i + BATCH_SIZE));

    async function runAll() {
      const results: Awaited<ReturnType<typeof extractAttendanceScreenshot>>[] = [];
      for (let i = 0; i < batches.length; i++) {
        results.push(await extractAttendanceScreenshot(batches[i]));
        if (i < batches.length - 1) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
      return results;
    }

    try {
      const results = await withTimeout(runAll(), EXTRACT_TIMEOUT_MS);
      const firstError = results.find((r) => r.error)?.error;
      if (firstError && results.every((r) => r.error)) {
        setError(firstError);
        return;
      }
      // Overlapping frames list the same player more than once — keep one row
      // per name (and the highest score seen for them).
      const byName = new Map<string, (typeof results)[number]["rows"][number]>();
      for (const r of results.flatMap((x) => x.rows)) {
        const key = r.nameOrChiefId.toLowerCase();
        const prev = byName.get(key);
        if (!prev) byName.set(key, r);
        else if ((r.score ?? -1) > (prev.score ?? -1)) byName.set(key, { ...prev, score: r.score });
      }
      let merged = [...byName.values()].map((r) => {
        const guessedMemberId = guessMemberId(r.nameOrChiefId, members);
        return { ...r, memberId: guessedMemberId, guessedMemberId };
      });
      // The same row read differently in different frames ("{wincheo}" vs
      // "{win|cheo}") comes back as separate names with the same score. An
      // unmatched row whose score equals another row's is almost certainly
      // one of those misreads, so drop it (preferring to keep a matched one).
      const before = merged.length;
      const keepers = new Set(merged.filter((r) => r.memberId && r.score != null).map((r) => r.score));
      const seenUnmatchedScore = new Set<number>();
      merged = merged.filter((r) => {
        if (r.memberId || r.score == null) return true;
        if (keepers.has(r.score) || seenUnmatchedScore.has(r.score)) return false;
        seenUnmatchedScore.add(r.score);
        return true;
      });
      const collapsed = collapseRows(merged);
      merged = collapsed.rows;
      setRows(merged);
      const dropped = before - merged.length - collapsed.notes.length;
      const notes = [
        firstError ? `Some batches failed and were skipped: ${firstError}` : "",
        dropped > 0 ? `Merged ${dropped} likely duplicate read${dropped === 1 ? "" : "s"} (same score, name unrecognised).` : "",
        ...collapsed.notes,
      ].filter(Boolean);
      if (notes.length) setError(notes.join(" "));
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
    const payload = rows.map((r) => ({
      ...r,
      manualMatch: r.memberId !== r.guessedMemberId,
    }));
    const result = await bulkImportAttendance(orgId, eventId, eventType, payload, options);
    setImporting(false);
    if (result.error) {
      setStatus(`Import failed: ${result.error}`);
      return;
    }
    if (result.eventId && result.eventId !== eventId) {
      router.push(`/${eventType}?event=${result.eventId}`);
    }
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
        + Import attendance from screenshot or video (AI)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          Upload one or more screenshots of a sign-up/attendance list. An AI model reads the names
          and statuses — always review before importing.
        </p>
        <input
          type="file"
          accept="image/*,video/*"
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

        {dupes.size > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Warning: {[...dupes].map((id) => members.find((m) => m.id === id)?.name ?? "A member").join(", ")}{" "}
            appear{dupes.size === 1 ? "s" : ""} on more than one row (highlighted). A member can only be in an
            event once — remove or re-match the extra rows to import.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">AI read</th>
                  <th className="px-2 py-1.5">Member</th>
                  <th className="px-2 py-1.5">Main / Sub</th>
                  {options?.mode !== "participating" && <th className="px-2 py-1.5">Score</th>}
                  {!options?.mode && <th className="px-2 py-1.5">Signed up</th>}
                  {!options?.mode && <th className="px-2 py-1.5">Arrived</th>}
                  {!options?.mode && <th className="px-2 py-1.5">Reason</th>}
                  <th className="px-2 py-1.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r, i) => (
                  <tr
                    key={i}
                    className={
                      r.memberId && dupes.has(r.memberId) ? "bg-amber-100/70" : r.memberId ? "" : "bg-red-50/60"
                    }
                  >
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
                      <select
                        value={r.lineupRole ?? ""}
                        onChange={(e) =>
                          updateRow(i, { lineupRole: (e.target.value || null) as "main" | "sub" | null })
                        }
                        className="rounded border border-slate-200 px-1.5 py-0.5"
                      >
                        <option value="">Keep current</option>
                        <option value="main">Main</option>
                        <option value="sub">Sub</option>
                      </select>
                    </td>
                    {options?.mode !== "participating" && (
                      <td className="px-2 py-1">
                        <input
                          type="number"
                          value={r.score ?? ""}
                          onChange={(e) =>
                            updateRow(i, { score: e.target.value === "" ? null : Number(e.target.value) })
                          }
                          className="w-24 rounded border border-slate-200 px-1.5 py-0.5"
                        />
                      </td>
                    )}
                    {!options?.mode && (
                      <>
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
                      </>
                    )}
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
                disabled={importing || dupes.size > 0}
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
