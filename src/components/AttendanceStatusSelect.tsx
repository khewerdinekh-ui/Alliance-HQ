"use client";

import { setAttendance } from "@/app/(app)/events/actions";

const STATUS_OPTIONS = [
  { value: "no_show", label: "No-show" },
  { value: "attended", label: "Attended" },
  { value: "excused", label: "Excused" },
];

export default function AttendanceStatusSelect({
  orgId,
  eventId,
  memberId,
  eventType,
  currentStatus,
}: {
  orgId: string;
  eventId: string;
  memberId: string;
  eventType: string;
  currentStatus: string;
}) {
  return (
    <form action={setAttendance}>
      <input type="hidden" name="orgId" value={orgId} />
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="memberId" value={memberId} />
      <input type="hidden" name="eventType" value={eventType} />
      <select
        name="status"
        defaultValue={currentStatus}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="rounded-lg border border-slate-300 px-2 py-1 text-sm"
      >
        {STATUS_OPTIONS.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </form>
  );
}
