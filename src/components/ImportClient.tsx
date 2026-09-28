"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  bulkImportMembers,
  extractMembersScreenshot,
  markMembersOld,
  type ImportRow,
} from "@/app/(app)/import/actions";
import { resizeImageDataUrl } from "@/lib/imageResize";
import { guessMemberId, type MatchableMember } from "@/lib/memberMatch";

type Row = ImportRow;

function parseCsv(text: string): Row[] {
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

// Grabs a handful of evenly-spaced, downscaled frames from a video file as
// JPEG data URLs — same approach as the Bear results video import.
function extractVideoFrames(file: File, frameCount = 16, maxDimension = 1000): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "auto";
    video.muted = true;
    video.src = URL.createObjectURL(file);

    const frames: string[] = [];
    let index = 0;

    video.onerror = () => reject(new Error("Couldn't read that video file."));

    video.onloadedmetadata = () => {
      let width = video.videoWidth;
      let height = video.videoHeight;
      if (width > maxDimension || height > maxDimension) {
        const scale = maxDimension / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas not supported."));
        return;
      }

      const seekNext = () => {
        if (index >= frameCount) {
          URL.revokeObjectURL(video.src);
          resolve(frames);
          return;
        }
        video.currentTime = (video.duration * (index + 1)) / (frameCount + 1);
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, width, height);
        frames.push(canvas.toDataURL("image/jpeg", 0.8));
        index += 1;
        seekNext();
      };

      seekNext();
    };
  });
}

const EXTRACT_TIMEOUT_MS = 120000;
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

type ImportResult = {
  newNames: string[];
  updatedNames: string[];
  missing: { id: string; name: string }[];
};

export default function ImportClient({
  subAlliances,
  members,
}: {
  subAlliances: { id: string; name: string }[];
  members: MatchableMember[];
}) {
  const router = useRouter();
  const [subAllianceId, setSubAllianceId] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [marking, setMarking] = useState(false);
  const [leftDate, setLeftDate] = useState(() => new Date().toISOString().slice(0, 10));

  const selectedAllianceName = subAlliances.find((a) => a.id === subAllianceId)?.name ?? "";

  function withGuesses(rows: Row[]): Row[] {
    return rows.map((r) => ({
      ...r,
      memberId: r.chiefId?.trim()
        ? (members.find((m) => m.chiefId === r.chiefId!.trim())?.id ?? "")
        : (guessMemberId(r.name, members) ?? ""),
    }));
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setRows(withGuesses(parseCsv(String(reader.result ?? ""))));
      setStatus(null);
      setResult(null);
    };
    reader.readAsText(file);
  }

  function handlePaste(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setRows(withGuesses(parseCsv(e.target.value)));
    setStatus(null);
    setResult(null);
  }

  // A single server call carrying many large frames risks running past the
  // hosting platform's function execution limit — that shows up as an opaque
  // "unexpected response"/"Server Action not found" error, not a clean
  // timeout. Splitting into small batches keeps each call fast regardless of
  // how many frames the video produced. But a big roster (16+ frames) can
  // still burst past OpenAI's tokens-per-minute limit even with a couple
  // retries, so batches run one at a time with a short pause between them —
  // slower, but it actually stays under the cap instead of hoping a retry
  // catches a mostly-exhausted window.
  const BATCH_SIZE = 2;
  const BATCH_DELAY_MS = 1500;

  async function runExtraction(dataUrls: string[]) {
    setExtracting(true);
    setError(null);
    setStatus(null);
    setResult(null);

    const batches: string[][] = [];
    for (let i = 0; i < dataUrls.length; i += BATCH_SIZE) {
      batches.push(dataUrls.slice(i, i + BATCH_SIZE));
    }

    async function runSequentially<T>(items: string[][], worker: (batch: string[]) => Promise<T>) {
      const results: T[] = [];
      for (let i = 0; i < items.length; i++) {
        results.push(await worker(items[i]));
        if (i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
        }
      }
      return results;
    }

    try {
      const results = await withTimeout(
        runSequentially(batches, (batch) => extractMembersScreenshot(batch)),
        EXTRACT_TIMEOUT_MS
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError && results.every((r) => r.error)) {
        setError(firstError);
        return;
      }
      // Batches are extracted independently, so the same person appearing in
      // two overlapping frames comes back as two rows — power is effectively
      // a unique fingerprint per player, so use it to merge duplicates.
      const allRows = results.flatMap((r) => r.rows);
      const seenPower = new Set<number>();
      const deduped = allRows.filter((r) => {
        if (r.power == null) return true;
        if (seenPower.has(r.power)) return false;
        seenPower.add(r.power);
        return true;
      });
      setRows(
        withGuesses(
          deduped.map((r) => ({
            name: r.name,
            power: r.power != null ? String(r.power) : "",
            level: r.level != null ? String(r.level) : "",
            rank: r.rank ?? "",
          }))
        )
      );
      if (firstError) {
        setError(`Some batches failed and were skipped: ${firstError}`);
      }
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
    try {
      const frames = await extractVideoFrames(file);
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
    const res = await bulkImportMembers(rows, subAllianceId || null);
    setImporting(false);
    if (res.error) {
      setStatus(res.error);
      return;
    }
    setStatus(
      `${res.newNames.length} new, ${res.updatedNames.length} updated.` +
        (subAllianceId ? "" : " Pick an alliance above to also see who's missing from the list.")
    );
    setResult({ newNames: res.newNames, updatedNames: res.updatedNames, missing: res.missing });
    setRows([]);
    router.refresh();
  }

  async function handleMarkOld(ids: string[]) {
    setMarking(true);
    await markMembersOld(ids, leftDate || null);
    setMarking(false);
    setResult((prev) => (prev ? { ...prev, missing: prev.missing.filter((m) => !ids.includes(m.id)) } : prev));
    router.refresh();
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Alliance</h2>
        <p className="mt-1 text-xs text-slate-500">
          Applies to every row below that doesn't specify its own alliance column. Pick one to also see
          who's no longer in the imported list.
        </p>
        <select
          value={subAllianceId}
          onChange={(e) => setSubAllianceId(e.target.value)}
          className="mt-2 rounded-lg border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">No specific alliance</option>
          {subAlliances.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>

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

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-900">Or import from photo/video (AI)</h2>
        <p className="mt-1 text-xs text-slate-500">
          Upload a screenshot or short video of the alliance member roster. An AI model reads names,
          power and level — always review before importing.
        </p>
        <div className="mt-3 flex flex-wrap gap-3">
          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            Photos
            <input type="file" accept="image/*" multiple onChange={handlePhotos} className="hidden" />
          </label>
          <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
            Video
            <input type="file" accept="video/*" onChange={handleVideo} className="hidden" />
          </label>
        </div>
        {extracting && <p className="mt-2 text-xs text-slate-500">Reading…</p>}
        {error && <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
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
                <th className="px-4 py-2">Match</th>
                <th className="px-4 py-2">Chief ID</th>
                <th className="px-4 py-2">Alliance</th>
                <th className="px-4 py-2">Rank</th>
                <th className="px-4 py-2">Power</th>
                <th className="px-4 py-2">Level</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.slice(0, 100).map((r, i) => (
                <tr key={i} className={r.memberId ? "" : "bg-emerald-50/50"}>
                  <td className="px-4 py-2">
                    <input
                      value={r.name}
                      onChange={(e) => updateRow(i, { name: e.target.value })}
                      className="w-28 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={r.memberId ?? ""}
                      onChange={(e) => updateRow(i, { memberId: e.target.value })}
                      className={`w-32 rounded border px-1.5 py-0.5 text-xs ${
                        r.memberId ? "border-slate-200" : "border-emerald-300 text-emerald-700"
                      }`}
                    >
                      <option value="">+ New member</option>
                      {members.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={r.chiefId ?? ""}
                      onChange={(e) => updateRow(i, { chiefId: e.target.value })}
                      className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2 text-slate-500">{r.alliance || selectedAllianceName || "—"}</td>
                  <td className="px-4 py-2">
                    <input
                      value={r.rank ?? ""}
                      onChange={(e) => updateRow(i, { rank: e.target.value })}
                      className="w-14 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={r.power ?? ""}
                      onChange={(e) => updateRow(i, { power: e.target.value })}
                      className="w-24 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      value={r.level ?? ""}
                      onChange={(e) => updateRow(i, { level: e.target.value })}
                      className="w-14 rounded border border-slate-200 px-1.5 py-0.5 text-xs"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <button onClick={() => removeRow(i)} className="text-red-500">
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 100 && (
            <p className="px-4 py-2 text-xs text-slate-400">
              …and {rows.length - 100} more rows.
            </p>
          )}
        </div>
      )}

      {status && <p className="text-sm text-slate-700">{status}</p>}

      {result && (
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
            <h3 className="text-sm font-semibold text-emerald-900">
              New members ({result.newNames.length})
            </h3>
            <p className="mt-1 text-xs text-emerald-700">
              {result.newNames.length ? result.newNames.join(", ") : "None — everyone matched an existing member."}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Updated ({result.updatedNames.length})
            </h3>
            <p className="mt-1 text-xs text-slate-500">
              {result.updatedNames.length ? result.updatedNames.join(", ") : "None."}
            </p>
          </div>
          {result.missing.length > 0 && (
            <div className="rounded-2xl border border-red-200 bg-red-50/60 p-4 sm:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-red-900">
                  No longer in the list ({result.missing.length})
                </h3>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-red-700">
                    Left on
                    <input
                      type="date"
                      value={leftDate}
                      onChange={(e) => setLeftDate(e.target.value)}
                      className="ml-1.5 rounded border border-red-200 px-1.5 py-1 text-xs"
                    />
                  </label>
                  <button
                    onClick={() => handleMarkOld(result.missing.map((m) => m.id))}
                    disabled={marking}
                    className="rounded-full bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-700 disabled:opacity-60"
                  >
                    {marking ? "Marking…" : "Mark all as old"}
                  </button>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                {result.missing.map((m) => (
                  <div key={m.id} className="flex items-center justify-between text-xs text-red-700">
                    <span>{m.name}</span>
                    <button
                      onClick={() => handleMarkOld([m.id])}
                      disabled={marking}
                      className="text-red-600 hover:underline disabled:opacity-60"
                    >
                      Mark as old
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
