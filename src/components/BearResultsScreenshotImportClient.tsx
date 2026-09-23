"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { bulkImportBearResults, extractBearResultsScreenshot } from "@/app/(app)/events/actions";
import { resizeImageDataUrl } from "@/lib/imageResize";

type Row = { nameOrChiefId: string; score: number };

// A slow AI extraction that never resolves would leave the UI stuck on
// "Reading…" forever with no feedback — race it against a timeout instead.
const EXTRACT_TIMEOUT_MS = 45000;
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

// Grabs a handful of evenly-spaced, downscaled frames from a video file as
// JPEG data URLs — smaller frames mean a faster upload and a faster vision
// model response, so the same extraction used for screenshots can read them
// without "ages" of waiting.
function extractVideoFrames(file: File, frameCount = 4, maxDimension = 1000): Promise<string[]> {
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
        const t = (video.duration * (index + 1)) / (frameCount + 1);
        video.currentTime = t;
      };

      video.onseeked = () => {
        ctx.drawImage(video, 0, 0, width, height);
        frames.push(canvas.toDataURL("image/jpeg", 0.65));
        index += 1;
        seekNext();
      };

      seekNext();
    };
  });
}

export default function BearResultsScreenshotImportClient({
  orgId,
  eventId,
}: {
  orgId: string;
  eventId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [unmatchedNames, setUnmatchedNames] = useState<string[]>([]);

  async function runExtraction(dataUrls: string[]) {
    setExtracting(true);
    setError(null);
    setStatus(null);
    try {
      const result = await withTimeout(extractBearResultsScreenshot(dataUrls), EXTRACT_TIMEOUT_MS);
      if (result.error) {
        setError(result.error);
        return;
      }
      setRows(result.rows);
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
    const result = await bulkImportBearResults(orgId, eventId, rows);
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

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-1.5">Name / Chief ID</th>
                  <th className="px-2 py-1.5">Score</th>
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
                        className="w-32 rounded border border-slate-200 px-1.5 py-0.5"
                      />
                    </td>
                    <td className="px-2 py-1">
                      <input
                        value={r.score}
                        onChange={(e) => updateRow(i, { score: Number(e.target.value) || 0 })}
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
        {unmatchedNames.length > 0 && (
          <p className="text-xs text-red-600">Didn't match: {unmatchedNames.join(", ")}</p>
        )}
      </div>
    </details>
  );
}
