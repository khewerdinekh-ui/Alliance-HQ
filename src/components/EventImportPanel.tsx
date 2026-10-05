"use client";

import { useState } from "react";
import type { AttendanceImportOptions, EventType } from "@/app/(app)/events/actions";
import type { MatchableMember } from "@/lib/memberMatch";
import AttendanceImportClient from "@/components/AttendanceImportClient";
import ScreenshotImportClient from "@/components/ScreenshotImportClient";

const LEGIONS = ["Legion 1", "Legion 2"];

// Lets the admin say what a screenshot/CSV is *for* before importing it: which
// legion, which event date, and whether the list shows people who signed up
// (participating) or people who actually turned up.
export default function EventImportPanel({
  orgId,
  eventId,
  eventType,
  eventDate,
  members: allMembers,
  subAlliances,
}: {
  orgId: string;
  eventId: string;
  eventType: EventType;
  eventDate: string;
  members: MatchableMember[];
  subAlliances: { id: string; name: string }[];
}) {
  const [alliance, setAlliance] = useState("");
  // Picking an alliance narrows who the importers can match names to, which
  // stops a misread name matching someone from a different alliance.
  const members = alliance ? allMembers.filter((m) => m.subAllianceId === alliance) : allMembers;
  const allianceName = subAlliances.find((a) => a.id === alliance)?.name;
  const [date, setDate] = useState(eventDate);
  const [legion, setLegion] = useState(LEGIONS[0]);
  const [mode, setMode] = useState<"participating" | "arrived">("participating");

  const options: AttendanceImportOptions = { eventDate: date || undefined, legion, mode };

  return (
    <div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
        <p className="text-xs font-semibold text-slate-700">Import settings</p>
        <div className="mt-2 flex flex-wrap items-end gap-3 text-xs text-slate-600">
          {subAlliances.length > 0 && (
            <label className="flex flex-col gap-1">
              Alliance
              <select
                value={alliance}
                onChange={(e) => setAlliance(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
              >
                <option value="">All alliances</option>
                {subAlliances.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="flex flex-col gap-1">
            Legion
            <select
              value={legion}
              onChange={(e) => setLegion(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            >
              {LEGIONS.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
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
            This list shows people who are
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as "participating" | "arrived")}
              className="rounded-lg border border-slate-200 bg-white px-2 py-1.5"
            >
              <option value="participating">Participating (signed up)</option>
              <option value="arrived">Turning up (arrived)</option>
            </select>
          </label>
        </div>
        <p className="mt-2 text-[11px] text-slate-500">
          Everyone imported is put in {legion} on {date || "the chosen date"}
          {allianceName ? `, matched against ${allianceName} members only` : ""}.{" "}
          {mode === "arrived"
            ? "They're marked as arrived."
            : "They're marked as signed up; anyone already marked arrived stays arrived."}{" "}
          A new event is created if that date doesn't exist yet.
        </p>
      </div>
      <AttendanceImportClient
        key={`csv-${eventId}`}
        orgId={orgId}
        eventId={eventId}
        eventType={eventType}
        members={members}
        options={options}
      />
      <ScreenshotImportClient
        key={`ai-${eventId}`}
        orgId={orgId}
        eventId={eventId}
        eventType={eventType}
        members={members}
        options={options}
      />
    </div>
  );
}
