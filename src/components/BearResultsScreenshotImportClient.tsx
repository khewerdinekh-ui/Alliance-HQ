"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportBearResults, extractBearResultsScreenshot } from "@/app/(app)/events/actions";
import { resizeImageDataUrl } from "@/lib/imageResize";
import { guessMemberId, type MatchableMember } from "@/lib/memberMatch";
import { collapseRows, duplicateMemberIds } from "@/lib/collapseRows";
import { extractVideoFrames } from "@/lib/videoFrames";

type Row = { nameOrChiefId: string; score: number; memberId: string | null; guessedMemberId: string | null };

// A slow AI extraction that never resolves would leave the UI stuck on
// "Reading…" forever with no feedback — race it against a timeout instead.
const EXTRACT_TIMEOUT_MS = 300000;
const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 1500;
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("This is taking too long. Try fewer photos, a shorter video, or check your connection.")),
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

export default function BearResultsScreenshotImportClient({
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
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const dupes = duplicateMemberIds(rows);

  async function runExtraction(dataUrls: string[]) {
    setExtracting(true);
    setError(null);
    setStatus(null);

    // Frames go to the server two at a time, one call after another, so no
    // single call runs past the host's time limit, request size limit or
    // OpenAI's per-minute cap (one big call with every frame is what made
    // longer videos fail).
    const batches: string[][] = [];
    for (let i = 0; i < dataUrls.length; i += BATCH_SIZE) batches.push(dataUrls.slice(i, i + BATCH_SIZE));

    async function runAll() {
      const results: Awaited<ReturnType<typeof extractBearResultsScreenshot>>[] = [];
      for (let i = 0; i < batches.length; i++) {
        results.push(await extractBearResultsScreenshot(batches[i]));
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
      const collapsed = collapseRows(
        results
          .flatMap((r) => r.rows)
          .map((r) => {
            const guessedMemberId = guessMemberId(r.nameOrChiefId, members);
            return { ...r, memberId: guessedMemberId, guessedMemberId };
          })
      );
      setRows(collapsed.rows);
      const notes = [
        firstError ? `Some batches failed and were skipped: ${firstError}` : "",
        ...collapsed.notes,
      ].filter(Boolean);
      setNotice(notes.length ? notes.join(" ") : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Extraction failed.");
    } finally {
      setExtracting(false);
    }
  }

  async function handlePhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    e.target.value = "";
    setExtracting(true);
    setError(null);
    setStatus(null);
    try {
      const dataUrls = await Promise.all(files.map((f) => resizeImageDataUrl(f)));
      await runExtraction(dataUrls);
    } catch (err) {
      setExtracting(false);
      setError(err instanceof Error ? err.message : "Couldn't read that image.");
    }
  }

  async function handleVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setExtracting(true);
    setError(null);
    setStatus(null);
    try {
      const frames = await extractVideoFrames(file, 24);
      await runExtraction(frames);
    } catch (err) {
      setExtracting(false);
      setError(err instanceof Error ? err.message : "Couldn't read that video.");
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
    const result = await bulkImportBearResults(orgId, eventId, payload);
    setImporting(false);
    if (result.error) {
      setStatus(`Import failed: ${result.error}`);
      return;
    }
    setStatus(
      `Imported ${result.imported} row${result.imported === 1 ? "" : "s"}.` +
        (result.unmatched ? ` ${result.unmatched} skipped (no member picked or no valid score).` : "")
    );
    setRows([]);
    router.refresh();
  }

  return (
    <details className="mt-3">
      <summary className="cursor-pointer text-xs font-medium text-violet-700 hover:underline">
        + Import results from photo or video (AI)
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-slate-500">
          Upload a screenshot or short video of the results screen. An AI model reads the names and
          scores — always review before importing.
        </p>
        <div className="flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            Photos
            <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
          </label>
          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            Video
            <input type="file" accept="video/*" onChange={handleVideo} className="hidden" />
          </label>
        </div>

        {extracting && <p className="text-xs text-slate-500">Reading…</p>}
        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

        {notice && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>}
        {dupes.size > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
            Warning: {[...dupes].map((id) => members.find((m) => m.id === id)?.name ?? "A member").join(", ")}{" "}
            appear{dupes.size === 1 ? "s" : ""} on more than one row (highlighted). A member can only have one
            result per event — remove or re-match the extra rows to import.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">AI read</th>
                  <th className="px-2 py-1.5">Member</th>
                  <th className="px-2 py-1.5">Score</th>
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
