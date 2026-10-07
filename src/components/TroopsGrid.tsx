"use client";

import { useMemo, useState } from "react";
import {
  extractTroopsScreenshot,
  importTroops,
  updateTroopRow,
  type TroopPatch,
} from "@/app/(app)/troops/actions";
import { resizeImageDataUrl } from "@/lib/imageResize";
import { extractVideoFrames } from "@/lib/videoFrames";
import { guessMemberId } from "@/lib/memberMatch";
import { duplicateMemberIds } from "@/lib/collapseRows";
import type { ExtractedTroopRow } from "@/lib/screenshotImport";

type Row = {
  memberId: string;
  name: string;
  aliases: string[];
  updatedAt: string | null;
  infantry: string;
  lancers: string;
  marksmen: string;
  slot1: boolean;
  slot2: boolean;
  slot3: boolean;
  status: string;
};

const SLOTS = [
  { key: "slot1", label: "12-14 UTC" },
  { key: "slot2", label: "14-16 UTC" },
  { key: "slot3", label: "15-17 UTC" },
] as const;

const STATUSES = ["Unavailable"];

// "T11(10)" = tier 11, level 10; "N(9)" = no tier yet, level 9.
const TIERS = ["T12", "T11", "N"];
const TROOP_OPTIONS = TIERS.flatMap((tier) =>
  Array.from({ length: 6 }, (_, i) => `${tier}(${10 - i})`)
);

// T12 red (blue below level 10), T11 at level 10 dark green, T11 lower light
// green, the rest grey — the same colour code the alliance's sheet uses.
function troopTone(value: string) {
  if (!value) return "bg-slate-100 text-slate-500";
  if (value.startsWith("T12")) return value === "T12(10)" ? "bg-red-700 text-white" : "bg-blue-700 text-white";
  if (value.startsWith("T11(10)")) return "bg-emerald-700 text-white";
  if (value.startsWith("T11")) return "bg-lime-200 text-emerald-900";
  return "bg-slate-100 text-slate-700";
}

// Same colours as ARGB for the Excel export.
function troopExcelColours(value: string): { fill: string; font: string } {
  if (!value) return { fill: "FFF1F5F9", font: "FF64748B" };
  if (value.startsWith("T12")) return { fill: value === "T12(10)" ? "FFB91C1C" : "FF1D4ED8", font: "FFFFFFFF" };
  if (value.startsWith("T11(10)")) return { fill: "FF047857", font: "FFFFFFFF" };
  if (value.startsWith("T11")) return { fill: "FFD9F99D", font: "FF14532D" };
  return { fill: "FFF1F5F9", font: "FF334155" };
}

const TROOP_COLUMNS = [
  { key: "infantry", label: "Infantry" },
  { key: "lancers", label: "Lancers" },
  { key: "marksmen", label: "Marksmen" },
] as const;

function formatUpdated(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

const BATCH_SIZE = 2;
const BATCH_DELAY_MS = 1500;

type ImportRow = ExtractedTroopRow & { memberId: string | null };

export default function TroopsGrid({ rows: initialRows, isAdmin }: { rows: Row[]; isAdmin: boolean }) {
  const [rows, setRows] = useState(initialRows);
  const [search, setSearch] = useState("");
  const [slotFilter, setSlotFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);

  const [importRows, setImportRows] = useState<ImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (slotFilter === "unavailable") return r.status === "Unavailable";
      if (slotFilter === "anyslot") return r.status !== "Unavailable" && (r.slot1 || r.slot2 || r.slot3);
      if (slotFilter === "allslots") return r.status !== "Unavailable" && r.slot1 && r.slot2 && r.slot3;
      if (slotFilter === "noslot") return !r.slot1 && !r.slot2 && !r.slot3;
      if (slotFilter !== "all") {
        return r.status !== "Unavailable" && r[slotFilter as "slot1" | "slot2" | "slot3"];
      }
      return true;
    });
  }, [rows, search, slotFilter]);

  async function save(memberId: string, patch: Partial<Row>) {
    const before = rows;
    setRows((prev) => prev.map((r) => (r.memberId === memberId ? { ...r, ...patch } : r)));
    setError(null);
    const { memberId: _m, name: _n, aliases: _a, updatedAt: _u, ...fields } = patch as Partial<Row> & {
      memberId?: string;
    };
    const res = await updateTroopRow(memberId, fields as TroopPatch);
    if (res.error) {
      setRows(before);
      setError(res.error);
    } else if (res.updatedAt) {
      // Only troop edits move "Last updated" (slots and status don't).
      setRows((prev) => prev.map((r) => (r.memberId === memberId ? { ...r, updatedAt: res.updatedAt } : r)));
    }
  }

  const available = (key: "slot1" | "slot2" | "slot3") =>
    rows.filter((r) => r[key] && r.status !== "Unavailable").length;

  // ---- Export to Excel ----------------------------------------------------
  async function exportExcel() {
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Troops");
    ws.columns = [
      { header: "Member", key: "name", width: 24 },
      { header: "Infantry", key: "infantry", width: 11 },
      { header: "Lancers", key: "lancers", width: 11 },
      { header: "Marksmen", key: "marksmen", width: 11 },
      { header: "12-14 UTC", key: "slot1", width: 11 },
      { header: "14-16 UTC", key: "slot2", width: 11 },
      { header: "15-17 UTC", key: "slot3", width: 11 },
      { header: "Status", key: "status", width: 13 },
      { header: "Last updated", key: "updated", width: 13 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1, xSplit: 1 }];

    for (const r of filtered) {
      const row = ws.addRow({
        name: r.name,
        infantry: r.infantry,
        lancers: r.lancers,
        marksmen: r.marksmen,
        slot1: r.slot1 ? "✓" : "",
        slot2: r.slot2 ? "✓" : "",
        slot3: r.slot3 ? "✓" : "",
        status: r.status,
        updated: r.infantry || r.lancers || r.marksmen ? (formatUpdated(r.updatedAt) === "—" ? "" : formatUpdated(r.updatedAt)) : "",
      });
      for (const col of TROOP_COLUMNS) {
        const cell = row.getCell(col.key);
        const c = troopExcelColours(r[col.key]);
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.fill } };
        cell.font = { color: { argb: c.font }, bold: true };
        cell.alignment = { horizontal: "center" };
      }
      for (const s of SLOTS) row.getCell(s.key).alignment = { horizontal: "center" };
      if (r.status === "Unavailable") {
        const cell = row.getCell("status");
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB91C1C" } };
        cell.font = { color: { argb: "FFFFFFFF" }, bold: true };
        cell.alignment = { horizontal: "center" };
      }
    }

    const buffer = await wb.xlsx.writeBuffer();
    const url = URL.createObjectURL(
      new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" })
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `troops-${new Date().toISOString().slice(0, 10)}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Import from screenshot / video ------------------------------------
  const matchable = rows.map((r) => ({ id: r.memberId, name: r.name, chiefId: null, aliases: r.aliases }));
  const dupes = duplicateMemberIds(importRows);

  async function readFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setReading(true);
    setImportMsg(null);
    try {
      const perFile = await Promise.all(
        files.map((f) =>
          f.type.startsWith("video/") ? extractVideoFrames(f, 24) : resizeImageDataUrl(f).then((u) => [u])
        )
      );
      const frames = perFile.flat();
      const batches: string[][] = [];
      for (let i = 0; i < frames.length; i += BATCH_SIZE) batches.push(frames.slice(i, i + BATCH_SIZE));

      const results: Awaited<ReturnType<typeof extractTroopsScreenshot>>[] = [];
      for (let i = 0; i < batches.length; i++) {
        results.push(await extractTroopsScreenshot(batches[i]));
        if (i < batches.length - 1) await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
      }
      const firstError = results.find((r) => r.error)?.error;
      if (firstError && results.every((r) => r.error)) {
        setImportMsg(firstError);
        return;
      }

      // The same player turns up in several frames: keep one row per name,
      // filling each field from the first frame that actually shows it.
      const byName = new Map<string, ExtractedTroopRow>();
      for (const r of results.flatMap((x) => x.rows)) {
        const key = r.name.toLowerCase();
        const prev = byName.get(key);
        if (!prev) {
          byName.set(key, { ...r });
        } else {
          byName.set(key, {
            name: prev.name,
            infantry: prev.infantry ?? r.infantry,
            lancers: prev.lancers ?? r.lancers,
            marksmen: prev.marksmen ?? r.marksmen,
            slot1: prev.slot1 ?? r.slot1,
            slot2: prev.slot2 ?? r.slot2,
            slot3: prev.slot3 ?? r.slot3,
            unavailable: prev.unavailable ?? r.unavailable,
          });
        }
      }
      setImportRows(
        [...byName.values()].map((r) => ({ ...r, memberId: guessMemberId(r.name, matchable) }))
      );
      if (firstError) setImportMsg(`Some batches failed and were skipped: ${firstError}`);
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Couldn't read that file.");
    } finally {
      setReading(false);
    }
  }

  async function applyImport() {
    setApplying(true);
    setImportMsg(null);
    const items = importRows
      .filter((r) => r.memberId)
      .map((r) => {
        const patch: TroopPatch = {};
        if (r.infantry) patch.infantry = r.infantry;
        if (r.lancers) patch.lancers = r.lancers;
        if (r.marksmen) patch.marksmen = r.marksmen;
        if (r.slot1 !== null) patch.slot1 = r.slot1;
        if (r.slot2 !== null) patch.slot2 = r.slot2;
        if (r.slot3 !== null) patch.slot3 = r.slot3;
        if (r.unavailable !== null) patch.status = r.unavailable ? "Unavailable" : "";
        return { memberId: r.memberId as string, patch };
      })
      .filter((i) => Object.keys(i.patch).length > 0);

    const res = await importTroops(items);
    setApplying(false);
    if (res.error && res.saved === 0) {
      setImportMsg(`Import failed: ${res.error}`);
      return;
    }
    setRows((prev) =>
      prev.map((r) => {
        const it = items.find((i) => i.memberId === r.memberId);
        if (!it) return r;
        const troopsChanged =
          it.patch.infantry !== undefined || it.patch.lancers !== undefined || it.patch.marksmen !== undefined;
        return {
          ...r,
          ...it.patch,
          status: it.patch.status ?? r.status,
          updatedAt: troopsChanged ? res.updatedAt : r.updatedAt,
        };
      })
    );
    setImportRows([]);
    setImportMsg(`Updated ${res.saved} member${res.saved === 1 ? "" : "s"}.${res.error ? ` Some failed: ${res.error}` : ""}`);
  }

  const cellTxt = (v: string | null) => v ?? "—";
  const slotTxt = (v: boolean | null) => (v === null ? "—" : v ? "✓" : "✗");

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search members"
          className="min-w-[160px] flex-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm focus:border-teal-500 focus:outline-none"
        />
        <select
          value={slotFilter}
          onChange={(e) => setSlotFilter(e.target.value)}
          className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700"
        >
          <option value="all">Everyone</option>
          <option value="anyslot">Available (any time slot ticked)</option>
          <option value="allslots">Available all times (all 3 ticked)</option>
          <option value="noslot">No time slot ticked</option>
          {SLOTS.map((s) => (
            <option key={s.key} value={s.key}>
              Available {s.label}
            </option>
          ))}
          <option value="unavailable">Unavailable</option>
        </select>
        <button
          onClick={exportExcel}
          className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          Export to Excel
        </button>
      </div>

      {isAdmin && (
        <details className="border-b border-slate-100 px-5 py-3">
          <summary className="cursor-pointer text-xs font-medium text-violet-700 hover:underline">
            + Import troops / availability from screenshot or video (AI)
          </summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs text-slate-500">
              Upload screenshots or a video of the troop/availability sheet. The AI reads each player&apos;s
              troop tiers, time slots and status. Only what it can see is changed, and always review before
              applying.
            </p>
            <div className="flex flex-wrap gap-3">
              <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                Photos
                <input type="file" accept="image/*" multiple onChange={readFiles} className="hidden" />
              </label>
              <label className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-xs text-slate-600 hover:bg-slate-50">
                Video
                <input type="file" accept="video/*" onChange={readFiles} className="hidden" />
              </label>
            </div>
            {reading && <p className="text-xs text-slate-500">Reading… this can take a minute or two.</p>}
            {importMsg && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{importMsg}</p>}
            {dupes.size > 0 && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                Warning: some members are on more than one row (highlighted). Remove or re-match the extras to
                apply.
              </p>
            )}

            {importRows.length > 0 && (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-2 py-1.5">AI read</th>
                      <th className="px-2 py-1.5">Member</th>
                      <th className="px-2 py-1.5">Inf</th>
                      <th className="px-2 py-1.5">Lan</th>
                      <th className="px-2 py-1.5">Mark</th>
                      <th className="px-2 py-1.5">12-14</th>
                      <th className="px-2 py-1.5">14-16</th>
                      <th className="px-2 py-1.5">15-17</th>
                      <th className="px-2 py-1.5">Unavail.</th>
                      <th className="px-2 py-1.5" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {importRows.map((r, i) => (
                      <tr
                        key={i}
                        className={
                          r.memberId && dupes.has(r.memberId)
                            ? "bg-amber-100/70"
                            : r.memberId
                              ? ""
                              : "bg-red-50/60"
                        }
                      >
                        <td className="px-2 py-1 text-slate-500">{r.name}</td>
                        <td className="px-2 py-1">
                          <select
                            value={r.memberId ?? ""}
                            onChange={(e) =>
                              setImportRows((prev) =>
                                prev.map((x, idx) => (idx === i ? { ...x, memberId: e.target.value || null } : x))
                              )
                            }
                            className={`w-28 rounded border px-1.5 py-0.5 ${r.memberId ? "border-slate-200" : "border-red-300"}`}
                          >
                            <option value="">— no match —</option>
                            {rows.map((m) => (
                              <option key={m.memberId} value={m.memberId}>
                                {m.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-2 py-1">{cellTxt(r.infantry)}</td>
                        <td className="px-2 py-1">{cellTxt(r.lancers)}</td>
                        <td className="px-2 py-1">{cellTxt(r.marksmen)}</td>
                        <td className="px-2 py-1">{slotTxt(r.slot1)}</td>
                        <td className="px-2 py-1">{slotTxt(r.slot2)}</td>
                        <td className="px-2 py-1">{slotTxt(r.slot3)}</td>
                        <td className="px-2 py-1">{slotTxt(r.unavailable)}</td>
                        <td className="px-2 py-1">
                          <button
                            onClick={() => setImportRows((prev) => prev.filter((_, idx) => idx !== i))}
                            className="text-red-500"
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="text-[11px] text-slate-500">
                    {importRows.length} row{importRows.length === 1 ? "" : "s"} — — means not shown, so it&apos;s left
                    unchanged
                    {importRows.some((r) => !r.memberId) ? " (red rows need a member picked or are skipped)" : ""}
                  </span>
                  <button
                    onClick={applyImport}
                    disabled={applying || dupes.size > 0}
                    className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    {applying ? "Applying…" : "Apply"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </details>
      )}

      <div className="flex flex-wrap gap-2 px-5 py-3 text-xs text-slate-600">
        {SLOTS.map((s) => (
          <span key={s.key} className="rounded-full bg-slate-100 px-3 py-1">
            {s.label}: <strong>{available(s.key)}</strong> available
          </span>
        ))}
        <span className="rounded-full bg-red-50 px-3 py-1 text-red-700">
          Unavailable: <strong>{rows.filter((r) => r.status === "Unavailable").length}</strong>
        </span>
      </div>

      {error && <p className="mx-5 mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-600">{error}</p>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-t border-slate-100 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-2">Member</th>
              {TROOP_COLUMNS.map((c) => (
                <th key={c.key} className="px-2 py-2">
                  {c.label}
                </th>
              ))}
              {SLOTS.map((s) => (
                <th key={s.key} className="px-2 py-2 text-center">
                  {s.label}
                </th>
              ))}
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Last updated</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r) => (
              <tr key={r.memberId}>
                <td className="px-4 py-1.5 font-medium text-slate-900">{r.name}</td>
                {TROOP_COLUMNS.map((c) => (
                  <td key={c.key} className="px-2 py-1.5">
                    {isAdmin ? (
                      <select
                        value={r[c.key]}
                        onChange={(e) => save(r.memberId, { [c.key]: e.target.value })}
                        className={`w-24 rounded-full border-0 px-2 py-1 text-xs font-medium ${troopTone(r[c.key])}`}
                      >
                        <option value=""></option>
                        {TROOP_OPTIONS.map((o) => (
                          <option key={o} value={o} className="bg-white text-slate-900">
                            {o}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={`inline-block w-24 rounded-full px-2 py-1 text-center text-xs font-medium ${troopTone(r[c.key])}`}>
                        {r[c.key] || "—"}
                      </span>
                    )}
                  </td>
                ))}
                {SLOTS.map((s) => (
                  <td key={s.key} className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={r[s.key]}
                      disabled={!isAdmin}
                      onChange={(e) => save(r.memberId, { [s.key]: e.target.checked })}
                      className="h-4 w-4"
                    />
                  </td>
                ))}
                <td className="px-2 py-1.5">
                  {isAdmin ? (
                    <select
                      value={r.status}
                      onChange={(e) => save(r.memberId, { status: e.target.value })}
                      className={`w-28 rounded-full border-0 px-2 py-1 text-xs font-medium ${
                        r.status === "Unavailable" ? "bg-red-700 text-white" : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      <option value=""></option>
                      {STATUSES.map((s) => (
                        <option key={s} value={s} className="bg-white text-slate-900">
                          {s}
                        </option>
                      ))}
                    </select>
                  ) : (
                    r.status && (
                      <span className="rounded-full bg-red-700 px-2 py-1 text-xs font-medium text-white">{r.status}</span>
                    )
                  )}
                </td>
                <td className="whitespace-nowrap px-2 py-1.5 text-xs text-slate-500">
                  {r.infantry || r.lancers || r.marksmen ? formatUpdated(r.updatedAt) : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-slate-400">
                  No members match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
