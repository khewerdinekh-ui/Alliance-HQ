import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireMembership } from "@/lib/membership";
import { createBearEvent, deleteEvent, updateBearTimes } from "@/app/(app)/events/actions";
import BearResultsLeaderboard from "@/components/BearResultsLeaderboard";
import BearResultsImportClient from "@/components/BearResultsImportClient";

export default async function BearAttendancePage({ selectedEventId }: { selectedEventId?: string }) {
  const membership = await requireMembership();
  const supabase = await createClient();
  const orgId = membership.orgId;
  const isAdmin = membership.isAdmin;

  const [{ data: org }, { data: events }, { data: members }] = await Promise.all([
    supabase
      .from("orgs")
      .select("bear_time_1, bear_time_2, bear_time_3, bear_time_4")
      .eq("id", orgId)
      .single(),
    supabase
      .from("events")
      .select("id, event_date, bear_slot")
      .eq("org_id", orgId)
      .eq("event_type", "bear")
      .order("event_date", { ascending: false })
      .order("bear_slot", { ascending: true }),
    supabase
      .from("members")
      .select("id, name")
      .eq("org_id", orgId)
      .eq("status", "current")
      .order("name"),
  ]);

  const bearTimes = [
    org?.bear_time_1 ?? "",
    org?.bear_time_2 ?? "",
    org?.bear_time_3 ?? "",
    org?.bear_time_4 ?? "",
  ];

  const activeEvent =
    (selectedEventId && events?.find((e) => e.id === selectedEventId)) || events?.[0];

  const { data: attendanceRows } = activeEvent
    ? await supabase
        .from("attendance")
        .select("member_id, score")
        .eq("event_id", activeEvent.id)
        .not("score", "is", null)
    : { data: [] as { member_id: string; score: number | null }[] };

  const memberNameById = new Map(members?.map((m) => [m.id, m.name]));
  const results = (attendanceRows ?? [])
    .filter((a) => memberNameById.has(a.member_id) && a.score != null)
    .map((a) => ({ memberId: a.member_id, name: memberNameById.get(a.member_id)!, score: a.score! }));

  function slotLabel(slot: number | null) {
    if (!slot) return "Bear";
    const time = bearTimes[slot - 1];
    return `Bear ${slot}${time ? ` · ${time}` : ""}`;
  }

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wide text-teal-700">Bear</h2>
      <h1 className="mt-1 text-2xl font-semibold text-slate-900">Bear results and attendance.</h1>
      <p className="mt-1 text-sm text-slate-500">
        Set the four Bear times and import each result. No sign-ups or punishments are used here.
      </p>

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-3 px-5 py-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.6" />
              <path d="M12 8v4l2.5 2.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Bear times</p>
            <p className="text-xs text-slate-500">Times can be changed whenever needed.</p>
          </div>
        </div>

        {isAdmin ? (
          <form
            action={updateBearTimes}
            className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-4"
          >
            <input type="hidden" name="orgId" value={orgId} />
            {[0, 1, 2, 3].map((i) => (
              <label key={i} className="text-xs text-slate-500">
                Bear {i + 1}
                <input
                  type="time"
                  name={`bearTime${i + 1}`}
                  defaultValue={bearTimes[i]}
                  className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                />
              </label>
            ))}
            <button
              type="submit"
              className="col-span-2 mt-1 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-700 sm:col-span-4"
            >
              Save times
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-3 border-t border-slate-100 px-5 py-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="text-xs text-slate-500">
                Bear {i + 1}
                <p className="mt-1 text-sm font-medium text-slate-900">{bearTimes[i] || "—"}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAdmin && (
        <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-3 px-5 py-4">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.6" />
                <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Bear event</p>
            </div>
          </div>
          <form
            action={createBearEvent}
            className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-4"
          >
            <input type="hidden" name="orgId" value={orgId} />
            <input
              type="date"
              name="eventDate"
              required
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none"
            />
            <select
              name="bearSlot"
              required
              defaultValue=""
              className="rounded-full border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none"
            >
              <option value="" disabled>
                Select slot
              </option>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {slotLabel(n)}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-amber-600/30 transition hover:bg-amber-700"
            >
              <span className="text-base leading-none">+</span> Add event
            </button>
          </form>
        </div>
      )}

      {events && events.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {events.map((e) => (
            <Link
              key={e.id}
              href={`/bear?event=${e.id}`}
              className={`rounded-xl border px-4 py-2 text-sm shadow-sm transition ${
                activeEvent?.id === e.id
                  ? "border-amber-300 bg-amber-50 text-amber-800"
                  : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <p className="font-semibold">{slotLabel(e.bear_slot)}</p>
              <p className="text-xs text-slate-500">
                {new Date(e.event_date).toLocaleDateString(undefined, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}
              </p>
            </Link>
          ))}
        </div>
      )}

      <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs text-slate-500">Bear event</p>
            <p className="text-sm font-semibold text-slate-900">
              {activeEvent ? `Viewing ${slotLabel(activeEvent.bear_slot)}` : "No Bear event yet"}
            </p>
          </div>
          {isAdmin && activeEvent && (
            <form action={deleteEvent}>
              <input type="hidden" name="id" value={activeEvent.id} />
              <input type="hidden" name="eventType" value="bear" />
              <button
                className="flex h-9 w-9 items-center justify-center rounded-full border border-red-100 text-red-500 transition hover:bg-red-50"
                aria-label="Delete event"
              >
                🗑
              </button>
            </form>
          )}
        </div>

        {isAdmin && activeEvent && (
          <div className="border-b border-slate-100 px-5 py-4">
            <BearResultsImportClient orgId={orgId} eventId={activeEvent.id} />
          </div>
        )}

        {!events?.length ? (
          <p className="px-5 pb-6 text-sm text-slate-400">No Bear event recorded yet.</p>
        ) : (
          activeEvent &&
          members && (
            <BearResultsLeaderboard
              orgId={orgId}
              eventId={activeEvent.id}
              isAdmin={isAdmin}
              members={members}
              results={results}
            />
          )
        )}
      </div>
    </>
  );
}
