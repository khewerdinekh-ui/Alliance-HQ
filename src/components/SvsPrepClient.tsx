"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { deletePrepEvent, extractPrepScreenshot, savePrepResults } from "@/app/(app)/svs-prep/actions";
import { resizeImageDataUrl } from "@/lib/imageResize";
import { extractVideoFrames } from "@/lib/videoFrames";
import { guessMemberId, type MatchableMember } from "@/lib/memberMatch";
import { collapseRows, duplicateMemberIds } from "@/lib/collapseRows";

type PrepEvent = {
  id: string;
  date: string;
  label: string;
  results: { name: string; rank: number | null; points: number | null }[];
};

type Row = {
  nameOrChiefId: string;
  rank: number | null;
  score: number | null; // points
  memberId: string | null;
};

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 1500;
const READ_TIMEOUT_MS = 480000;

export default function SvsPrepClient({
  isAdmin,
  members,
  events,
}: {
  isAdmin: boolean;
  members: MatchableMember[];
  events: PrepEvent[];
}) {
  const router = useRouter();
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [label, setLabel] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const dupes = duplicateMemberIds(rows);
  const matched = rows.filter((r) => r.memberId).length;

  async function readFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setReading(true);
    setError(null);
    setMsg(null);
    try {
      const perFile = await Promise.all(
        files.map((f) =>
          f.type.startsWith("video/") ? extractVideoFrames(f, 36) : resizeImageDataUrl(f).then((u) => [u])
        )
      );
      const frames = perFile.flat();
      const batches: string[][] = [];
      for (let i = 0; i < frames.length; i += BATCH_SIZE) batches.push(frames.slice(i, i + BATCH_SIZE));

      const run = async () => {
        const out: Awaited<ReturnType<typeof extractPrepScreenshot>>[] = [];
        for (let i = 0; i < batches.length; i++) {
          out.push(await extractPrepScreenshot(batches[i]));
          if (i < batches.length - 1) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
        }
        return out;
      };
      const results = await Promise.race([
        run(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("This is taking too long. Try a shorter video.")), READ_TIMEOUT_MS)
        ),
      ]);

      const firstError = results.find((r) => r.error)?.error;
      if (firstError && results.every((r) => r.error)) {
        setError(firstError);
        return;
      }

      // Overlapping frames repeat players; keep one row per name (best rank/points),
      // then drop anything read below 100th.
      const collapsed = collapseRows(
        results
          .flatMap((r) => r.rows)
          .filter((r) => r.rank == null || r.rank <= 100)
          .map((r) => ({
            nameOrChiefId: r.name,
            rank: r.rank,
            score: r.points,
            memberId: guessMemberId(r.name, members),
          }))
      );
      const sorted = [...collapsed.rows].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999)).slice(0, 100);
      setRows(sorted);
      setMsg(
        [
          firstError ? `Some batches failed and were skipped: ${firstError}` : "",
          ...collapsed.notes,
        ]
          .filter(Boolean)
          .join(" ") || null
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    const res = await savePrepResults(
      date,
      label,
      rows.filter((r) => r.memberId).map((r) => ({ memberId: r.memberId as string, rank: r.rank, points: r.score }))
    );
    setSaving(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setMsg(`Saved ${res.saved} member${res.saved === 1 ? "" : "s"} in the top 100 for ${date}${label ? ` (${label})` : ""}.`);
    setRows([]);
    router.refresh();
  }

  async function remove(id: string) {
    if (!window.confirm("Delete this prep import? Those top-100 entries stop counting in the percentages.")) return;
    const res = await deletePrepEvent(id);
    if (res.error) setError(res.error);
    else router.refresh();
  }

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-900">Import prep leaderboard</h2>
          <p className="mt-1 text-xs text-slate-500">
            Upload a video or screenshots of the SvS prep points ranking. The AI reads each player&apos;s rank,
            name and points — always review before saving. Importing the same date and label again replaces
            that import.
          </p>
          <div className="mt-3 flex flex-wrap items-end gap-3 text-xs text-slate-600">
            <label className="flex flex-col gap-1">
              Date
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
              />
            </label>
            <label className="flex flex-col gap-1">
              Label (optional, e.g. Day 3)
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-40 rounded-lg border border-slate-200 bg-white px-2 py-1.5"
              />
            </label>
            <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50">
              Photos
              <input type="file" accept="image/*" multiple onChange={readFiles} className="hidden" />
            </label>
            <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-600 hover:bg-slate-50">
              Video
              <input type="file" accept="video/*" onChange={readFiles} className="hidden" />
            </label>
          </div>
          {reading && <p className="mt-3 text-xs text-slate-500">Reading… this can take a few minutes for a long video.</p>}
          {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}
          {msg && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{msg}</p>}
          {dupes.size > 0 && (
            <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
              Warning: some members are on more than one row (highlighted). Remove or re-match the extras to save.
            </p>
          )}

          {rows.length > 0 && (
            <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
              <div className="max-h-96 overflow-auto">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">Rank</th>
                      <th className="px-2 py-1.5">AI read</th>
                      <th className="px-2 py-1.5">Member</th>
                      <th className="px-2 py-1.5">Points</th>
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
                        <td className="px-2 py-1 text-slate-500">{r.rank ?? "—"}</td>
                        <td className="px-2 py-1 text-slate-500">{r.nameOrChiefId}</td>
                        <td className="px-2 py-1">
                          <select
                            value={r.memberId ?? ""}
                            onChange={(e) =>
                              setRows((prev) =>
                                prev.map((x, idx) => (idx === i ? { ...x, memberId: e.target.value || null } : x))
                              )
                            }
                            className={`w-36 rounded border px-1.5 py-0.5 ${r.memberId ? "border-slate-200" : "border-red-300"}`}
                          >
                            <option value="">— not in alliance —</option>
                            {members.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1 text-slate-500">{r.score?.toLocaleString() ?? "—"}</td>
                        <td className="px-2 py-1">
                          <button
                            onClick={() => setRows((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-red-500"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
                <span className="text-[11px] text-slate-500">
                  {rows.length} read, {matched} matched to members. Red rows (players from outside the alliance
                  or unmatched) are left out of the count.
                </span>
                <button
                  onClick={save}
                  disabled={saving || dupes.size > 0 || matched === 0}
                  className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <h2 className="px-5 pt-4 text-sm font-semibold text-slate-900">Past imports ({events.length})</h2>
        {events.length === 0 ? (
          <p className="px-5 pb-5 pt-2 text-sm text-slate-400">No SvS prep imported yet.</p>
        ) : (
          <div className="divide-y divide-slate-100 pb-2 pt-2">
            {events.map((e) => (
              <div key={e.id} className="px-5 py-2">
                <div className="flex items-center justify-between gap-3">
                  <button
                    onClick={() => setOpen(open === e.id ? null : e.id)}
                    className="text-left text-sm font-medium text-slate-900 hover:underline"
                  >
                    {e.date}
                    {e.label ? ` · ${e.label}` : ""}
                    <span className="ml-2 text-xs font-normal text-slate-500">
                      {e.results.length} alliance member{e.results.length === 1 ? "" : "s"} in the top 100
                    </span>
                  </button>
                  {isAdmin && (
                    <button onClick={() => remove(e.id)} className="text-xs text-red-500 hover:underline">
                      Delete
                    </button>
                  )}
                </div>
                {open === e.id && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-600">
                    {e.results
                      .map((r) => `${r.rank != null ? `#${r.rank} ` : ""}${r.name}${r.points != null ? ` (${r.points.toLocaleString()})` : ""}`)
                      .join(", ") || "No members matched."}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
