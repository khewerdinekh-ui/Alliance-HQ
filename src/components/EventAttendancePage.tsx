import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import {
  addPunishment,
  createEvent,
  deleteEvent,
  resolvePunishment,
  type EventType,
} from "@/app/(app)/events/actions";
import EventDatePicker from "@/components/EventDatePicker";
import AttendanceGrid from "@/components/AttendanceGrid";
import DoNotSignUpPanel from "@/components/DoNotSignUpPanel";
import AttendanceImportClient from "@/components/AttendanceImportClient";
import ScreenshotImportClient from "@/components/ScreenshotImportClient";

const LABELS: Record<EventType, string> = {
  foundry: "Foundry",
  canyon: "Canyon",
  bear: "Bear",
};

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

  const [{ data: events }, { data: members }, { data: punishments }, { data: resolvedPunishments }] =
    await Promise.all([
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
      supabase
        .from("punishments")
        .select("id, required_events, reason, created_at, resolved_at, members(name)")
        .eq("org_id", orgId)
        .eq("event_type", eventType)
        .eq("resolved", true)
        .order("resolved_at", { ascending: false })
        .limit(20),
    ]);

  const activeEvent =
    (selectedEventId && events?.find((e) => e.id === selectedEventId)) || events?.[0];

  const { data: attendanceRows } = activeEvent
    ? await supabase
        .from("attendance")
        .select("member_id, status, legion, lineup_role, signed_up, reason")
        .eq("event_id", activeEvent.id)
    : {
        data: [] as {
          member_id: string;
          status: string;
          legion: string | null;
          lineup_role: string;
          signed_up: boolean;
          reason: string | null;
        }[],
      };

  const attendanceByMember = new Map(attendanceRows?.map((a) => [a.member_id, a]));

  // Remaining = required events minus completed events of this type since the punishment started.
  const eventsCountSince = (since: string) =>
    events?.filter((e) => e.event_date >= since.slice(0, 10)).length ?? 0;

  const memberNameById = new Map(members?.map((m) => [m.id, m.name]));
  const punishedMemberIds = new Set(punishments?.map((p) => p.member_id));

  // "Don't sign up next time": no-shows from the single most recent event, not already punished.
  const mostRecentEvent = events?.[0];
  const { data: latestAttendance } = mostRecentEvent
    ? await supabase
        .from("attendance")
        .select("member_id, status")
        .eq("event_id", mostRecentEvent.id)
        .eq("status", "no_show")
        .eq("signed_up", true)
    : { data: [] as { member_id: string; status: string }[] };

  const doNotSignUp = (latestAttendance ?? [])
    .filter((a) => memberNameById.has(a.member_id) && !punishedMemberIds.has(a.member_id))
    .map((a) => ({ memberId: a.member_id, name: memberNameById.get(a.member_id)! }));

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">
            {label} attendance
          </h2>
          <h1 className="mt-1 text-2xl font-semibold text-slate-900">
            Sign-ups and participation.
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Keep a record for each {label} event. Building locations will be added separately.
          </p>
        </div>

        {isAdmin && (
          <form action={createEvent} className="flex items-center gap-2">
            <input type="hidden" name="orgId" value={orgId} />
            <input type="hidden" name="eventType" value={eventType} />
            <input
              type="date"
              name="eventDate"
              required
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none"
            />
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full bg-teal-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-teal-600/30 transition hover:bg-teal-700"
            >
              <span className="text-base leading-none">+</span> New event
            </button>
          </form>
        )}
      </div>

      {eventType !== "bear" && isAdmin && doNotSignUp.length > 0 && mostRecentEvent && (
        <DoNotSignUpPanel
          orgId={orgId}
          eventType={eventType}
          label={label}
          eventDate={mostRecentEvent.event_date}
          members={doNotSignUp}
        />
      )}

      {eventType !== "bear" && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-amber-100 bg-amber-50/60">
          <div className="flex items-start justify-between px-5 py-4">
            <div>
              <h3 className="text-sm font-semibold text-amber-900">
                Active {label} punishments
              </h3>
              <p className="mt-0.5 text-xs text-amber-700">
                Players stay here until the chosen number of completed {label} events has passed.
              </p>
            </div>
            <span className="flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 px-1.5 text-xs font-semibold text-amber-700">
              {punishments?.length ?? 0}
            </span>
          </div>

          <div className="px-5 pb-5">
            {punishments?.length ? (
              <div className="space-y-2">
                {punishments.map((p) => {
                  const remaining = Math.max(0, p.required_events - eventsCountSince(p.created_at));
                  const memberName = (p.members as unknown as { name: string } | null)?.name ?? "—";
                  return (
                    <div
                      key={p.id}
                      className="flex items-center justify-between rounded-xl border border-amber-100 bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-slate-900">{memberName}</p>
                        <p className="text-xs text-slate-500">
                          {remaining} event{remaining === 1 ? "" : "s"} remaining
                          {p.reason ? ` — ${p.reason}` : ""}
                        </p>
                      </div>
                      {isAdmin && (
                        <form action={resolvePunishment}>
                          <input type="hidden" name="id" value={p.id} />
                          <input type="hidden" name="eventType" value={eventType} />
                          <button className="rounded-full border border-amber-200 px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-50">
                            Resolve
                          </button>
                        </form>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-amber-700">No active {label} punishments.</p>
            )}

            {isAdmin && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-amber-800 hover:underline">
                  + Add punishment manually
                </summary>
                <form action={addPunishment} className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
                  <input type="hidden" name="orgId" value={orgId} />
                  <input type="hidden" name="eventType" value={eventType} />
                  <select
                    name="memberId"
                    required
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:col-span-2"
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
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Events"
                  />
                  <input
                    name="reason"
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    placeholder="Reason (optional)"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-amber-700"
                  >
                    Add
                  </button>
                </form>
              </details>
            )}

            {resolvedPunishments && resolvedPunishments.length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs font-medium text-amber-800 hover:underline">
                  Punishment history ({resolvedPunishments.length})
                </summary>
                <div className="mt-2 space-y-1.5">
                  {resolvedPunishments.map((p) => {
                    const memberName = (p.members as unknown as { name: string } | null)?.name ?? "—";
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg border border-amber-100 bg-white px-3 py-2 text-xs text-slate-600"
                      >
                        <span className="font-medium text-slate-900">{memberName}</span> — applied{" "}
                        {new Date(p.created_at).toLocaleDateString()},{" "}
                        {p.required_events} event{p.required_events === 1 ? "" : "s"}
                        {p.resolved_at
                          ? `, resolved ${new Date(p.resolved_at).toLocaleDateString()}`
                          : ""}
                        {p.reason ? ` — ${p.reason}` : ""}
                      </div>
                    );
                  })}
                </div>
              </details>
            )}
          </div>
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-xs text-slate-500">{label} event</p>
              <p className="text-sm font-semibold text-slate-900">
                {activeEvent ? "Viewing this date" : "Select a date to view or update"}
              </p>
            </div>
          </div>
          {events && events.length > 0 && (
            <div className="flex items-center gap-2">
              <EventDatePicker
                eventType={eventType}
                events={events}
                activeEventId={activeEvent?.id ?? null}
              />
              {isAdmin && activeEvent && (
                <form action={deleteEvent}>
                  <input type="hidden" name="id" value={activeEvent.id} />
                  <input type="hidden" name="eventType" value={eventType} />
                  <button
                    className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-500 transition hover:bg-red-50"
                    aria-label="Delete event"
                  >
                    🗑
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {isAdmin && activeEvent && (
          <div className="border-b border-slate-100 px-5 py-4">
            <AttendanceImportClient orgId={orgId} eventId={activeEvent.id} eventType={eventType} />
            <ScreenshotImportClient orgId={orgId} eventId={activeEvent.id} eventType={eventType} />
          </div>
        )}

        {!events?.length ? (
          <p className="px-5 pb-6 text-sm text-slate-400">
            No completed {label} event recorded yet.
          </p>
        ) : (
          activeEvent &&
          members && (
            <AttendanceGrid
              orgId={orgId}
              eventId={activeEvent.id}
              eventType={eventType}
              isAdmin={isAdmin}
              rows={members.map((m) => {
                const a = attendanceByMember.get(m.id);
                return {
                  memberId: m.id,
                  name: m.name,
                  legion: a?.legion ?? null,
                  lineupRole: (a?.lineup_role as "main" | "sub") ?? "main",
                  signedUp: a?.signed_up ?? false,
                  arrived: a?.status === "attended",
                  reason: a?.reason ?? "",
                  isPunished: punishedMemberIds.has(m.id),
                };
              })}
            />
          )
        )}
      </div>
    </>
  );
}
