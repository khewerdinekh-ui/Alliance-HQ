"use client";

import { useMemo, useState } from "react";

type ExportRow = {
  name: string;
  allianceName: string;
  alliance_rank: string;
  power: number | null;
  overallPct: number;
};

const DISCORD_LIMIT = 1900; // Discord caps a message at 2,000 characters.

function compactPower(p: number | null) {
  if (!p) return "-";
  if (p >= 1e9) return `${(p / 1e9).toFixed(2)}B`;
  if (p >= 1e6) return `${(p / 1e6).toFixed(1)}M`;
  return p.toLocaleString();
}

function pad(s: string, n: number) {
  return s.length >= n ? s.slice(0, n) : s + " ".repeat(n - s.length);
}

// A monospace table inside ``` blocks so Discord keeps the columns lined up.
// Long lists are split into several messages, each repeating the header.
function buildChunks(rows: ExportRow[], cols: { alliance: boolean; power: boolean }) {
  const nameW = Math.min(18, Math.max(6, ...rows.map((r) => r.name.length)));
  const allianceW = Math.max(8, ...rows.map((r) => r.allianceName.length));

  const header =
    pad("Name", nameW) +
    (cols.alliance ? "  " + pad("Alliance", allianceW) : "") +
    "  Rk" +
    (cols.power ? "  " + pad("Power", 7) : "") +
    "  Att%";
  const line = (r: ExportRow) =>
    pad(r.name, nameW) +
    (cols.alliance ? "  " + pad(r.allianceName || "-", allianceW) : "") +
    "  " +
    pad(r.alliance_rank, 2) +
    (cols.power ? "  " + pad(compactPower(r.power), 7) : "") +
    "  " +
    `${r.overallPct}%`;

  const chunks: string[] = [];
  let body: string[] = [];
  const wrap = (lines: string[]) => "```\n" + header + "\n" + lines.join("\n") + "\n```";
  for (const r of rows) {
    const next = [...body, line(r)];
    if (wrap(next).length > DISCORD_LIMIT && body.length > 0) {
      chunks.push(wrap(body));
      body = [line(r)];
    } else {
      body = next;
    }
  }
  if (body.length) chunks.push(wrap(body));
  return chunks;
}

export default function ExportTableModal({ rows, onClose }: { rows: ExportRow[]; onClose: () => void }) {
  const [alliance, setAlliance] = useState(true);
  const [power, setPower] = useState(false);
  const [copied, setCopied] = useState<number | null>(null);

  const chunks = useMemo(() => buildChunks(rows, { alliance, power }), [rows, alliance, power]);

  async function copy(i: number) {
    try {
      await navigator.clipboard.writeText(chunks[i]);
      setCopied(i);
      setTimeout(() => setCopied((c) => (c === i ? null : c)), 2000);
    } catch {
      // Clipboard blocked — the text is also selectable in the box below.
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Copy for Discord</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {rows.length} member{rows.length === 1 ? "" : "s"} from the current filters.
              {chunks.length > 1
                ? ` Discord limits messages to 2,000 characters, so this is ${chunks.length} messages — paste them in order.`
                : ""}
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="mt-4 flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={alliance} onChange={(e) => setAlliance(e.target.checked)} /> Alliance
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={power} onChange={(e) => setPower(e.target.checked)} /> Power
          </label>
        </div>

        <div className="mt-4 space-y-4">
          {chunks.map((c, i) => (
            <div key={i}>
              <div className="mb-1 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">
                  {chunks.length > 1 ? `Message ${i + 1} of ${chunks.length}` : "Message"}
                </span>
                <button
                  onClick={() => copy(i)}
                  className="rounded-full bg-teal-600 px-3 py-1 text-xs font-semibold text-white hover:bg-teal-700"
                >
                  {copied === i ? "Copied!" : "Copy"}
                </button>
              </div>
              <pre className="max-h-48 overflow-auto rounded-lg bg-slate-900 p-3 text-[11px] leading-snug text-slate-100">
                {c}
              </pre>
            </div>
          ))}
          {chunks.length === 0 && <p className="text-sm text-slate-500">No members to export.</p>}
        </div>
      </div>
    </div>
  );
}
