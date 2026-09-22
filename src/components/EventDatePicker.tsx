"use client";

import { useRouter } from "next/navigation";

export default function EventDatePicker({
  eventType,
  events,
  activeEventId,
}: {
  eventType: string;
  events: { id: string; event_date: string }[];
  activeEventId: string | null;
}) {
  const router = useRouter();

  return (
    <select
      value={activeEventId ?? ""}
      onChange={(e) => router.push(`/${eventType}?event=${e.target.value}`)}
      className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm focus:border-teal-500 focus:outline-none"
    >
      {events.map((e) => (
        <option key={e.id} value={e.id}>
          {new Date(e.event_date).toLocaleDateString(undefined, {
            day: "numeric",
            month: "short",
            year: "numeric",
          })}
        </option>
      ))}
    </select>
  );
}
