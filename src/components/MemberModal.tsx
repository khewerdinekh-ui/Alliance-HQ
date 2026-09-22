"use client";

import { useState, useTransition } from "react";
import { saveMember } from "@/app/(app)/members/actions";

export type EditableMember = {
  id: string;
  name: string;
  chief_id: string | null;
  power: number | null;
  level: number | null;
  alliance_rank: string;
  status: string;
  sub_alliance_id: string | null;
  aliases: string[];
};

export default function MemberModal({
  orgId,
  subAlliances,
  member,
  onClose,
}: {
  orgId: string;
  subAlliances: { id: string; name: string }[];
  member: EditableMember | null;
  onClose: () => void;
}) {
  const isEdit = Boolean(member);
  const [name, setName] = useState(member?.name ?? "");
  const [subAllianceId, setSubAllianceId] = useState(member?.sub_alliance_id ?? "");
  const [isCurrent, setIsCurrent] = useState(member ? member.status === "current" : true);
  const [chiefId, setChiefId] = useState(member?.chief_id ?? "");
  const [aliases, setAliases] = useState(member?.aliases.join(", ") ?? "");
  const [power, setPower] = useState(member?.power != null ? String(member.power) : "");
  const [level, setLevel] = useState(member?.level != null ? String(member.level) : "");
  const [allianceRank, setAllianceRank] = useState(member?.alliance_rank ?? "R1");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSave() {
    startTransition(async () => {
      const result = await saveMember({
        id: member?.id,
        orgId,
        name,
        chiefId,
        subAllianceId,
        allianceRank,
        status: isCurrent ? "current" : "old",
        power,
        level,
        aliases,
      });
      if (result.error) {
        setError(result.error);
      } else {
        onClose();
      }
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4 py-8">
      <div className="w-full max-w-sm max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {isEdit ? "Edit member" : "Add member"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Add their main alliance details. Event information is kept separately.
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

        <div className="mt-5 space-y-4">
          <Field label="Player name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>

          <Field label="Alliance">
            <select
              value={subAllianceId}
              onChange={(e) => setSubAllianceId(e.target.value)}
              className={inputClass}
            >
              <option value="">No alliance</option>
              {subAlliances.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <button
            type="button"
            onClick={() => setIsCurrent((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left"
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${
                isCurrent ? "bg-teal-600" : "border border-slate-300 bg-white"
              }`}
            >
              {isCurrent && (
                <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 text-white">
                  <path
                    d="M3 8l3 3 7-7"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              )}
            </span>
            <span className="text-sm font-medium text-slate-800">Current member</span>
          </button>

          <Field label="Chief ID" hint="(optional)">
            <input
              value={chiefId}
              onChange={(e) => setChiefId(e.target.value)}
              inputMode="numeric"
              className={inputClass}
            />
          </Field>

          <Field label="Previous names" hint="(optional)">
            <input
              value={aliases}
              onChange={(e) => setAliases(e.target.value)}
              placeholder="e.g. Jeycob, OldName"
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-400">
              Separate multiple names with commas. Imports and history will match them to this
              member.
            </p>
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Power">
              <input
                value={power}
                onChange={(e) => setPower(e.target.value)}
                placeholder="e.g. 1B"
                className={inputClass}
              />
            </Field>
            <Field label="Level">
              <input
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                placeholder="e.g. 10"
                className={inputClass}
              />
            </Field>
          </div>

          <Field label="Alliance rank">
            <select
              value={allianceRank}
              onChange={(e) => setAllianceRank(e.target.value)}
              className={inputClass}
            >
              {["R1", "R2", "R3", "R4", "R5"].map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </Field>

          {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={pending || !name.trim()}
            className="rounded-xl bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 disabled:opacity-60"
          >
            {pending ? "Saving…" : isEdit ? "Save changes" : "Add member"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700">
        {label}
        {hint && <span className="ml-1 font-normal text-slate-400">{hint}</span>}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
