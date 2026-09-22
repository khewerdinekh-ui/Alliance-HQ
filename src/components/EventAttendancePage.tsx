import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import {
  addPunishment,
  createEvent,
  deleteEvent,
  resolvePunishment,
  type EventType,
} from "@/app/(app)/events/actions";
import AttendanceStatusSelect from "@/components/AttendanceStatusSelect";

const LABELS: Record<EventType, string> = {
  foundry: "Foundry",
  canyon: "Canyon",
  bear: "Bear",
};

const STATUS_OPTIONS = [
  { value: "no_show", label: "No-show" },
  { value: "attended", label: "Attended" },
  { value: "excused", label: "Excused" },
];

export default async function EventAttendancePage({
  eventType,
  selectedEventId,
}: {
  eventType: EventType;
  selectedEventId?: string;
}) {
  const membership = await requireMembership();
  const supabase = await createClient();
  const orgId = membership.orgId;
  const isAdmin = membership.isAdmin;
  const label = LABELS[eventType];

  const [{ data: events }, { data: members }, { data: punishments }] = await Promise.all([
    supabase
      .from("events")
      .select("id, event_date")
      .eq("org_id", orgId)
      .eq("event_type", eventType)
      .order("event_date", { ascending: false }),
    supabase
      .from("members")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("status", "current")
      .order("name"),
    supabase
      .from("punishments")
      .select("id, member_id, required_events, reason, created_at, members(name)")
      .eq("org_id", orgId)
      .eq("event_type", eventType)
      .eq("resolved", false),
  ]);

  const activeEvent = selectedEventId
    ? events?.find((e) => e.id === selectedEventId)
    : events?.[0];

  const { data: attendanceRows } = activeEvent
    ? await supabase
        .from("attendance")
        .select("member_id, status")
        .eq("event_id", activeEvent.id)
    : { data: [] as { member_id: string; status: string }[] };

  const attendanceByMember = new Map(attendanceRows?.map((a) => [a.member_id, a.status]));

  // Remaining = required events minus completed events of this type since the punishment started.
  const eventsCountSince = (since: string) =>
    events?.filter((e) => e.event_date >= since.slice(0, 10)).length ?? 0;

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
        {label} attendance
      </h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Sign-ups and participation.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Keep a record for each {label} event. Building locations will be added separately.
      </p>

      {isAdmin && (
        <form
          action={createEvent}
          className="mt-6 flex flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <input type="hidden" name="orgId" value={orgId} />
          <input type="hidden" name="eventType" value={eventType} />
          <div>
            <label className="block text-xs font-medium text-slate-600">New event date</label>
            <input
              type="date"
              name="eventDate"
              required
              className="mt-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
          >
            New event
          </button>
        </form>
      )}

      {!events?.length ? (
        <p className="mt-8 text-sm text-slate-400">
          No completed {label} event recorded yet.
        </p>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {events.map((e) => (
              <Link
                key={e.id}
                href={`/${eventType}?event=${e.id}`}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  activeEvent?.id === e.id
                    ? "bg-teal-600 text-white"
                    : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
                }`}
              >
                {e.event_date}
              </Link>
            ))}
          </div>

          {activeEvent && (
            <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-900">
                  {activeEvent.event_date} attendance
                </h3>
                {isAdmin && (
                  <form action={deleteEvent}>
                    <input type="hidden" name="id" value={activeEvent.id} />
                    <input type="hidden" name="eventType" value={eventType} />
                    <button className="text-xs text-red-600 hover:underline">
                      Delete event
                    </button>
                  </form>
                )}
              </div>
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Member</th>
                    <th className="px-4 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {members?.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2 text-slate-900">{m.name}</td>
                      <td className="px-4 py-2">
                        {isAdmin ? (
                          <AttendanceStatusSelect
                            orgId={orgId}
                            eventId={activeEvent.id}
                            memberId={m.id}
                            eventType={eventType}
                            currentStatus={attendanceByMember.get(m.id) ?? "no_show"}
                          />
                        ) : (
                          <span className="text-slate-600">
                            {STATUS_OPTIONS.find(
                              (s) => s.value === (attendanceByMember.get(m.id) ?? "no_show")
                            )?.label}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!members?.length && (
                    <tr>
                      <td colSpan={2} className="px-4 py-6 text-center text-slate-400">
                        No current members.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900">
          Active {label} punishments
        </h3>
        <p className="mt-1 text-xs text-slate-500">
          Players stay here until the chosen number of completed {label} events has passed.
        </p>

        {isAdmin && (
          <form
            action={addPunishment}
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-5"
          >
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="eventType" value={eventType} />
            <select
              name="memberId"
              required
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:col-span-2"
              defaultValue=""
            >
              <option value="" disabled>
                Select member
              </option>
              {members?.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
            <input
              name="requiredEvents"
              type="number"
              min={1}
              defaultValue={1}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Events"
            />
            <input
              name="reason"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Reason (optional)"
            />
            <button
              type="submit"
              className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-teal-700"
            >
              Add punishment
            </button>
          </form>
        )}

        <div className="mt-4 divide-y divide-slate-100">
          {punishments?.map((p) => {
            const remaining = Math.max(
              0,
              p.required_events - eventsCountSince(p.created_at)
            );
            const memberName = (p.members as unknown as { name: string } | null)?.name ?? "—";
            return (
              <div key={p.id} className="flex items-center justify-between py-2 text-sm">
                <div>
                  <span className="font-medium text-slate-900">{memberName}</span>
                  <span className="ml-2 text-slate-500">
                    {remaining} event{remaining === 1 ? "" : "s"} remaining
                  </span>
                  {p.reason && <span className="ml-2 text-slate-400">— {p.reason}</span>}
                </div>
                {isAdmin && (
                  <form action={resolvePunishment}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="eventType" value={eventType} />
                    <button className="text-xs text-teal-700 hover:underline">Resolve</button>
                  </form>
                )}
              </div>
            );
          })}
          {!punishments?.length && (
            <p className="py-4 text-sm text-slate-400">No active {label} punishments.</p>
          )}
        </div>
      </div>
    </>
  );
}
